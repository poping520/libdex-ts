import { Dexfile, DexField, DexMethod } from "./dexfile";
import { DexUtils } from "./utils";

/**
 * 计算 UTF-8 字符串的 31-based hash（与 Java String.hashCode 类似）。
 */
export function computeUtf8Hash(utf8Str: string): number {
    if (utf8Str == null) {
        throw new TypeError("utf8Str is null or undefined");
    }

    const bytes = new TextEncoder().encode(utf8Str);
    let hash = 1 >>> 0;
    for (let i = 0; i < bytes.length; i++) {
        hash = (hash * 31 + bytes[i]) >>> 0;
    }
    return hash;
}

export interface JavaMethod {
    accessFlags: number;
    name: string;
    returnType: string;
    parameterTypes: string[];
}

export interface JavaField {
    accessFlags: number;
    name: string;
    type: string;
}

export interface JavaClass {
    accessFlags: number;
    name: string;
    super: string;
    interfaces?: string[] | null;
    fields?: JavaField[] | null;
    methods?: JavaMethod[] | null;
}

export class DexClassLoader {

    private readonly dexFile: Dexfile;

    private readonly classCache = new Map<string, JavaClass | null>();

    /**
     * 创建一个基于 DexFile 的类加载器（带缓存）。
     */
    constructor(dexFile: Dexfile) {
        this.dexFile = dexFile;
    }

    /**
     * 查找并解析指定类。
     * @param className 点分名（java.lang.String）或描述符（Ljava/lang/String;）
     */
    findClass(className: string): JavaClass | null {
        const descriptor = this.normalizeToDescriptor(className);

        const cached = this.classCache.get(descriptor);
        if (cached !== undefined) {
            return cached;
        }

        const classDef = this.dexFile.getClassDefByDescriptor(descriptor);
        if (!classDef) {
            this.classCache.set(descriptor, null);
            return null;
        }

        const superClassName = this.dexFile.getClassNameByIdx(classDef.superclassIdx);

        // Interfaces
        let interfaces = [];
        const typeList = this.dexFile.getInterfacesList(classDef);
        if (typeList !== null) {
            for (let i = 0; i < typeList.size; i++) {
                const typeIdx = typeList.typeIdxList[i];
                const className = this.dexFile.getClassNameByIdx(typeIdx);
                interfaces.push(className);
            }
        }

        const classData = this.dexFile.getClassData(classDef);

        // Fields
        const fields: JavaField[] = [];
        this.parseDexFields(classData.instanceFields, fields);
        this.parseDexFields(classData.staticFields, fields);

        // Methods
        const methods: JavaMethod[] = [];
        this.parseDexMethods(classData.directMethods, methods);
        this.parseDexMethods(classData.virtualMethods, methods);

        const cls: JavaClass = {
            accessFlags: classDef.accessFlags,
            name: className,
            super: superClassName,
            interfaces: interfaces,
            fields: fields,
            methods: methods,
        };

        this.classCache.set(descriptor, cls);
        return cls;
    }

    private parseDexFields(dexFields: DexField[], out: JavaField[]): void {
        let fieldIdx = 0;
        for (const df of dexFields) {
            fieldIdx += df.fieldIdx;
            const fieldId = this.dexFile.getFieldId(fieldIdx);
            const type = this.dexFile.getClassNameByIdx(fieldId.typeIdx);
            const name = this.dexFile.getStringById(fieldId.nameIdx);

            out.push({
                accessFlags: df.accessFlags,
                name,
                type
            });
        }
    }

    private parseDexMethods(dexMethods: DexMethod[], out: JavaMethod[]): void {
        let methodIdx = 0;
        for (const dm of dexMethods) {
            methodIdx += dm.methodIdx;
            const methodId = this.dexFile.getMethodId(methodIdx);
            const name = this.dexFile.getStringById(methodId.nameIdx);

            const protoId = this.dexFile.getProtoId(methodId.protoIdx);

            // const shorty = this.dexFile.getStringById(protoId.shortyIdx);
            const returnType = this.dexFile.getClassNameByIdx(protoId.returnTypeIdx);

            const parameterTypes: string[] = [];
            if (protoId.parametersOff > 0) {
                const typeList = this.dexFile.getTypeListByOff(protoId.parametersOff);
                for (const typeIdx of typeList.typeIdxList) {
                    const className = this.dexFile.getClassNameByIdx(typeIdx);
                    parameterTypes.push(className);
                }
            }

            out.push({
                accessFlags: dm.accessFlags,
                name,
                returnType,
                parameterTypes
            });
        }
    }

    private normalizeToDescriptor(className: string): string {
        if (className.length > 0 && className[0] === "[") {
            return className.replace(/\./g, "/");
        }
        if (className.length > 1 && className[0] === "L" && className[className.length - 1] === ";") {
            return className.replace(/\./g, "/");
        }
        return DexUtils.dotToDescriptor(className);
    }
}


