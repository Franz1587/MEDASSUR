from pathlib import Path
import subprocess

p = Path('/opt/medassur/backend/dist/src/auth/auth.service.js')
text = p.read_text()

old1 = "let user = await this.prisma.user.findUnique({ where: { email: identifiant } });"
new1 = (
    "const identifiantNettoye = identifiant.trim();\\n"
    "        const emailNormalisee = identifiantNettoye.toLowerCase();\\n"
    "        let user = await this.prisma.user.findFirst({\\n"
    "            where: { email: { equals: emailNormalisee, mode: \\\"insensitive\\\" } },\\n"
    "        });"
)
if old1 not in text:
    raise SystemExit('pattern 1 not found')
text = text.replace(old1, new1)

old2 = "assureSante: { OR: [{ matricule: identifiant }, { telephone: identifiant }, { email: identifiant }] }"
new2 = (
    "assureSante: { OR: [{ matricule: { equals: identifiantNettoye, mode: \\\"insensitive\\\" } }, "
    "{ telephone: { equals: identifiantNettoye, mode: \\\"insensitive\\\" } }, "
    "{ email: { equals: emailNormalisee, mode: \\\"insensitive\\\" } }] }"
)
if old2 not in text:
    raise SystemExit('pattern 2 not found')
text = text.replace(old2, new2)
p.write_text(text)

subprocess.run([
    'docker', 'exec', 'medassur-pg-local', 'psql', '-U', 'medassur', '-d', 'medassur_prod_copy',
    '-c', 'UPDATE "User" SET email = lower(email) WHERE email <> lower(email);'
], check=True)
print('patched dist auth service and normalized mixed-case emails')
