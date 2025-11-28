#!/usr/bin/env python3
"""Discover E2B Sandbox methods"""

import os
from dotenv import load_dotenv
from e2b import Sandbox

load_dotenv()
api_key = os.getenv("E2B_API_KEY")

try:
    sandbox = Sandbox(api_key=api_key)
    
    # List all attributes and methods
    attrs = [attr for attr in dir(sandbox) if not attr.startswith('_')]
    
    print("Available Sandbox attributes and methods:")
    for attr in sorted(attrs):
        obj = getattr(sandbox, attr)
        if callable(obj):
            print(f"  - {attr}() [method]")
        else:
            print(f"  - {attr} [attribute]")
    
    # Try to access common attributes
    print("\nTrying to access sandbox properties:")
    for prop in ['id', 'url', 'metadata', 'cwd']:
        try:
            value = getattr(sandbox, prop, 'NOT FOUND')
            print(f"  - sandbox.{prop} = {value}")
        except Exception as e:
            print(f"  - sandbox.{prop} = ERROR: {e}")
    
    sandbox.close()
    print("\n✅ Sandbox closed successfully")
    
except Exception as e:
    print(f"Error creating sandbox: {e}")