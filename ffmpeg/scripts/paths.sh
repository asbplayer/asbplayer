#!/bin/bash

# Resolve paths from this helper so every entry point uses the same package roots.
package_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repository_root="$(cd "$package_root/.." && pwd)"
