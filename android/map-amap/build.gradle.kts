plugins {
    alias(libs.plugins.android.library)
}
android {
    namespace = "com.didi.dimina.map.amap"
    compileSdk = 35
    defaultConfig { minSdk = 26 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
dependencies {
    api(project(":dimina"))
    implementation(libs.androidx.activity.compose)
    implementation("com.amap.api:3dmap-location-search:11.2.100_loc11.2.100_sea9.8.1")
    testImplementation(libs.junit)
    testImplementation(libs.org.json)
}
