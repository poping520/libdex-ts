import {DexClassDumper, DexClassLoader, DexFile} from "libdex-ts";

function performanceTest(base: NativePointer, size: number) {
    console.log("\n========== Performance Test ==========");
    console.log(`DEX Size: ${size} bytes`);
    
    const testClass = "android.support.v4.app.FragmentActivity";
    const iterations = 3;
    
    // Test 1: NativePointerBuffer (direct pointer reading)
    console.log("\n[Test 1] NativePointerBuffer (on-demand reading)");
    const nativeTimings: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
        const startNative = Date.now();
        try {
            const dexFile = new DexFile(base, size);
            const classloader = new DexClassLoader(dexFile);
            const clz = classloader.findClassResolved(testClass);
            // if (clz) {
            //     DexClassDumper.dump(clz);
            // }
            const endNative = Date.now();
            nativeTimings.push(endNative - startNative);
            console.log(`  Iteration ${i + 1}: ${endNative - startNative}ms`);
        } catch (e) {
            console.log(`  Iteration ${i + 1}: Failed - ${e}`);
        }
    }
    
    // Test 2: ByteBuffer (load all data first)
    console.log("\n[Test 2] ByteBuffer (load all data first)");
    const byteTimings: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
        const startByte = Date.now();
        try {
            const array = base.readByteArray(size);
            const data = new Uint8Array(array!);
            const dexFile = new DexFile(data);
            const classloader = new DexClassLoader(dexFile);
            const clz = classloader.findClassResolved(testClass);
            // if (clz) {
            //     DexClassDumper.dump(clz);
            // }
            const endByte = Date.now();
            byteTimings.push(endByte - startByte);
            console.log(`  Iteration ${i + 1}: ${endByte - startByte}ms`);
        } catch (e) {
            console.log(`  Iteration ${i + 1}: Failed - ${e}`);
        }
    }
    
    // Calculate statistics
    const avgNative = nativeTimings.reduce((a, b) => a + b, 0) / nativeTimings.length;
    const avgByte = byteTimings.reduce((a, b) => a + b, 0) / byteTimings.length;
    const minNative = Math.min(...nativeTimings);
    const maxNative = Math.max(...nativeTimings);
    const minByte = Math.min(...byteTimings);
    const maxByte = Math.max(...byteTimings);
    
    console.log("\n========== Results ==========");
    console.log(`NativePointerBuffer:`);
    console.log(`  Average: ${avgNative.toFixed(2)}ms`);
    console.log(`  Min: ${minNative}ms, Max: ${maxNative}ms`);
    console.log(`ByteBuffer:`);
    console.log(`  Average: ${avgByte.toFixed(2)}ms`);
    console.log(`  Min: ${minByte}ms, Max: ${maxByte}ms`);
    console.log(`\nPerformance Difference:`);
    console.log(`  ${avgNative < avgByte ? 'NativePointerBuffer' : 'ByteBuffer'} is faster by ${Math.abs(avgByte - avgNative).toFixed(2)}ms (${Math.abs((avgByte - avgNative) / avgByte * 100).toFixed(2)}%)`);
    console.log("=====================================\n");
}

function handleDex(base: NativePointer, size: number) {
    // Run performance test
    performanceTest(base, size);
}

function hookOpenCommon(): void {
    try {
        const openCommonSymbols = Process
            .findModuleByName("libart.so")!
            .enumerateExports()
            .filter(sym =>
                sym.name.includes("OpenCommon") &&
                (sym.name.includes("DexFileLoader") || sym.name.includes("ArtDexFileLoader"))
            );

        openCommonSymbols.forEach(sym => {
            console.log(`[*] Hooking OpenCommon: ${sym.name}`);
            try {
                Interceptor.attach(sym.address, {
                    onEnter: function (args) {
                        const base = args[1];
                        const size = args[2].toInt32();

                        if (base.readCString(3) === "dex") {
                            console.log(`Find dex: ${base}, size: ${size}`);
                            handleDex(base, size);
                        }
                    },
                    onLeave: function (retval) {

                    }
                });
            } catch (e) {
                console.log(`[-] Failed to hook ${sym.name}: ${e}`);
            }
        });
    } catch (e) {
        console.log(`[-] Error in hookOpenCommon: ${e}`);
    }
}

setImmediate(hookOpenCommon);