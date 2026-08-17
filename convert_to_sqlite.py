import re

with open('prisma/schema.prisma', 'r') as f:
    content = f.read()

# Replace @default(ENUM_VALUE) with @default("ENUM_VALUE")
# Find @default([A-Z_]+)
content = re.sub(r'@default\(([A-Z_]+)\)', r'@default("\1")', content)

with open('prisma/schema.prisma', 'w') as f:
    f.write(content)
