#!/usr/bin/env python3
"""Final E2B API key test"""

import os
from dotenv import load_dotenv
from e2b import Sandbox

load_dotenv()
api_key = os.getenv("E2B_API_KEY")

if not api_key:
    print("❌ E2B_API_KEY not found in .env file")
    exit(1)

print(f"Testing E2B API key: {api_key[:10]}...")

try:
    # Create sandbox
    sandbox = Sandbox(api_key=api_key)
    print("✅ Successfully created E2B sandbox!")
    
    # Get sandbox info
    try:
        sandbox_id = sandbox.sandbox_id
        print(f"   Sandbox ID: {sandbox_id}")
    except:
        print("   Sandbox ID: (not accessible)")
    
    # Test file operations
    try:
        print("\n🔄 Testing file operations...")
        sandbox.files.write("/tmp/test.txt", "E2B is working!")
        content = sandbox.files.read("/tmp/test.txt")
        print(f"✅ File operations working: {content}")
    except Exception as e:
        print(f"⚠️  File operations not available: {e}")
    
    # Test command execution
    try:
        print("\n🔄 Testing command execution...")
        result = sandbox.commands.run("echo 'Hello from E2B!'")
        if hasattr(result, 'stdout'):
            print(f"✅ Command execution working: {result.stdout.strip()}")
        else:
            print(f"✅ Command executed (output: {result})")
    except Exception as e:
        print(f"⚠️  Command execution not available: {e}")
    
    # Check if sandbox is running
    try:
        is_running = sandbox.is_running()
        print(f"\n✅ Sandbox status: {'Running' if is_running else 'Not running'}")
    except:
        print("\n✅ Sandbox created successfully")
    
    # Kill sandbox
    try:
        sandbox.kill()
        print("✅ Sandbox terminated successfully")
    except:
        pass
    
    print("\n✅ E2B API KEY IS VALID AND WORKING!")
    print("   You can use E2B sandboxes in your application.")
    
except Exception as e:
    error_msg = str(e)
    print(f"\n❌ E2B API key validation failed:")
    print(f"   Error: {error_msg}")
    
    if "401" in error_msg or "unauthorized" in error_msg.lower():
        print("   → The API key is invalid or expired")
        print("   → Please check your E2B_API_KEY in the .env file")
    elif "404" in error_msg:
        print("   → E2B service endpoint not found")
    elif "quota" in error_msg.lower() or "limit" in error_msg.lower():
        print("   → You may have exceeded your usage quota")
    elif "connection" in error_msg.lower():
        print("   → Connection error - check internet connectivity")
    else:
        print("   → Please verify your API key at https://e2b.dev")