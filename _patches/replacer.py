#!/usr/bin/env python

import sys
import re

try:
    _, target_file, pattern, replacement = sys.argv
except ValueError as e:
    raise e

with open(target_file, "r") as file:
    content = file.read()

regex = re.compile(re.escape(pattern), re.DOTALL | re.MULTILINE )
new_content, number_of_subs_made = re.subn(pattern, replacement, content)
print(f"Made {number_of_subs_made} substitutions in file {target_file}")

with open(target_file, "w") as file:
   file.write(new_content)