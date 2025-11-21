// Build script for napi-rs bindings
// This generates the necessary glue code for Node.js FFI

extern crate napi_build;

fn main() {
    napi_build::setup();
}
