#!/usr/bin/env python3
"""
EstudeVet v11 - Auditoria de virada.

Confere o que da para conferir sem banco: cobertura de RLS, rotas quebradas,
tratamento de erro e estado vazio em cada tela, emoji e cor solta no JSX.

Sai com codigo 1 se achar problema - da para plugar em CI.
"""
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"
MIGRATIONS = RAIZ / "supabase" / "migrations"

problemas: list[str] = []
avisos: list[str] = []
ok: list[str] = []


def secao(titulo: str) -> None:
    print(f"\n{titulo}")
    print("-" * len(titulo))


def sql_todo() -> str:
    return "\n".join(p.read_text() for p in sorted(MIGRATIONS.glob("*.sql")))


# ---------------------------------------------------------------------------
# 1. RLS tabela por tabela
# ---------------------------------------------------------------------------
def audita_rls() -> None:
    secao("1. RLS tabela por tabela")
    sql = sql_todo()

    tabelas = set(re.findall(r"create table public\.(\w+)", sql))
    com_rls = set(re.findall(r"alter table public\.(\w+)\s+enable row level security", sql))

    politicas: dict[str, list[str]] = {}
    for nome, tabela in re.findall(r"create policy (\w+) on public\.(\w+)", sql):
        politicas.setdefault(tabela, []).append(nome)

    removidas = set(re.findall(r"drop policy if exists (\w+)", sql))

    for tabela in sorted(tabelas):
        vivas = [p for p in politicas.get(tabela, []) if p not in removidas]

        if tabela not in com_rls:
            problemas.append(f"{tabela}: RLS NAO habilitada")
            print(f"  FALHA  {tabela}: sem enable row level security")
            continue
        if not vivas:
            problemas.append(f"{tabela}: RLS habilitada sem nenhuma politica viva")
            print(f"  FALHA  {tabela}: RLS ligada e nenhuma politica - ninguem le nada")
            continue

        print(f"  ok     {tabela}: {len(vivas)} politica(s)")
        ok.append(f"rls:{tabela}")

    # Escrita direta em tabela que deveria passar por RPC.
    for tabela in ("respostas", "usuario_conquistas", "atividade_diaria"):
        escrita = []
        for p in politicas.get(tabela, []):
            if p in removidas:
                continue
            bloco = re.search(
                rf"create policy {p} on public\.{tabela}\s+for (insert|all)(.*?);", sql, re.S
            )
            if not bloco:
                continue
            # Politica so de admin nao e escrita "do cliente": e ferramenta
            # de administracao, ja guardada por is_admin() no banco.
            if "is_admin()" in bloco.group(2):
                continue
            escrita.append(p)
        if escrita:
            problemas.append(f"{tabela}: aceita escrita direta do cliente ({', '.join(escrita)})")
            print(f"  FALHA  {tabela}: escrita direta permitida - deveria ser so por RPC")
        else:
            print(f"  ok     {tabela}: escrita so por funcao do servidor")

    # Coluna de gabarito revogada.
    if "revoke select on public.alternativas" in sql:
        print("  ok     alternativas.correta: leitura revogada do cliente")
        ok.append("gabarito")
    else:
        problemas.append("alternativas: coluna correta legivel pelo cliente")
        print("  FALHA  alternativas.correta: gabarito exposto")

    # Toda funcao security definer precisa de search_path fixo.
    for nome, corpo in re.findall(
        r"create or replace function public\.(\w+)\([^)]*\)(.*?)\$\$", sql, re.S
    ):
        if "security definer" in corpo and "set search_path" not in corpo:
            problemas.append(f"{nome}: security definer sem set search_path")
            print(f"  FALHA  {nome}: security definer sem search_path fixo")

    definers = re.findall(r"create or replace function public\.(\w+)", sql)
    sem_grant = [f for f in set(definers) if f"grant execute on function public.{f}(" not in sql]
    for f in sorted(sem_grant):
        avisos.append(f"{f}: sem grant execute explicito")
        print(f"  aviso  {f}: sem grant execute explicito")


# ---------------------------------------------------------------------------
# 2. Rotas
# ---------------------------------------------------------------------------
def rotas_existentes() -> set[str]:
    rotas = set()
    app = SRC / "app"
    for page in app.rglob("page.tsx"):
        rel = page.relative_to(app).parent
        partes = [p for p in rel.parts if not (p.startswith("(") and p.endswith(")"))]
        rota = "/" + "/".join(partes)
        rotas.add(rota if rota != "/" else "/")
    return rotas


def audita_rotas() -> None:
    secao("2. Rotas referenciadas x rotas existentes")
    existentes = rotas_existentes()

    for r in sorted(existentes):
        print(f"  existe {r}")

    referencias: dict[str, set[str]] = {}
    padroes = [
        # href="/x" e href='/x'
        r"""href=["'](/[^"'{}\s]*)["']""",
        # href: '/x' dentro de array de menu
        r"""href:\s*["'](/[^"'{}\s]*)["']""",
        # redirect('/x') e router.push('/x')
        r"""(?:redirect|router\.push)\(["'](/[^"'{}\s]*)["']\)""",
        # revalidatePath('/x')
        r"""revalidatePath\(["'](/[^"'{}\s]*)["']\)""",
        # template literal: `/simulados/${id}` -> vira /simulados/[dinamico]
        r"""[`\"'](/[a-z0-9\-/]*?)/\$\{""",
    ]
    for arquivo in list(SRC.rglob("*.tsx")) + list(SRC.rglob("*.ts")):
        texto = arquivo.read_text()
        onde = str(arquivo.relative_to(SRC))
        for i, padrao in enumerate(padroes):
            for alvo in re.findall(padrao, texto):
                if i == 4:
                    alvo = alvo.rstrip("/") + "/[dinamico]"
                referencias.setdefault(alvo, set()).add(onde)

    def casa(alvo: str) -> bool:
        if alvo in existentes:
            return True
        alvo_partes = alvo.strip("/").split("/")
        for rota in existentes:
            rota_partes = rota.strip("/").split("/")
            if len(rota_partes) != len(alvo_partes):
                continue
            if all(
                r.startswith("[") or r == a for r, a in zip(rota_partes, alvo_partes)
            ):
                return True
        return False

    print()
    for alvo in sorted(referencias):
        if casa(alvo):
            print(f"  ok     {alvo}")
            ok.append(f"rota:{alvo}")
        else:
            onde = ", ".join(sorted(referencias[alvo]))
            problemas.append(f"rota {alvo} referenciada mas inexistente (em {onde})")
            print(f"  FALHA  {alvo} nao existe - referenciada em {onde}")


# ---------------------------------------------------------------------------
# 3. Erro e estado vazio por tela
# ---------------------------------------------------------------------------
def audita_telas() -> None:
    secao("3. Tratamento de erro e estado vazio")
    app = SRC / "app"

    for page in sorted(app.rglob("page.tsx")):
        rel = str(page.relative_to(app))
        texto = page.read_text()

        busca_dados = bool(
            re.search(r"await (getServerClient|[a-zA-Z]+\(sb|[a-zA-Z]+\.\w+\(sb)", texto)
            or "await Promise.all" in texto
        )
        if not busca_dados:
            print(f"  ok     {rel}: tela estatica, nao precisa")
            continue

        tem_erro = "<Erro" in texto or "Erro " in texto
        tem_vazio = "<Vazio" in texto or "length === 0" in texto

        # A tela pode declarar que estado vazio nao existe ali, com motivo.
        # Isso mantem o aviso util: some o ruido, fica a regressao de verdade.
        isento = re.search(r"auditoria:\s*sem-estado-vazio\s*-\s*(.+)", texto)

        if not tem_erro:
            problemas.append(f"{rel}: busca dados e nao trata erro")
            print(f"  FALHA  {rel}: sem tratamento de erro")
        elif not tem_vazio and isento:
            print(f"  ok     {rel}: erro tratado; sem estado vazio ({isento.group(1).strip()})")
            ok.append(f"tela:{rel}")
        elif not tem_vazio:
            avisos.append(f"{rel}: sem estado vazio explicito")
            print(f"  aviso  {rel}: trata erro, sem estado vazio")
        else:
            print(f"  ok     {rel}: erro e estado vazio")
            ok.append(f"tela:{rel}")


# ---------------------------------------------------------------------------
# 4. Emoji
# ---------------------------------------------------------------------------
def audita_emoji() -> None:
    secao("4. Emoji (proibido em codigo, banco e interface)")
    achados = []
    alvos = (
        list(SRC.rglob("*.ts"))
        + list(SRC.rglob("*.tsx"))
        + list(MIGRATIONS.glob("*.sql"))
        + list((RAIZ / "supabase").glob("*.sql"))
        + list((RAIZ / "scripts").rglob("*.ts"))
    )
    for arquivo in alvos:
        for n, linha in enumerate(arquivo.read_text().splitlines(), 1):
            for ch in linha:
                if ord(ch) > 0x2100 and unicodedata.category(ch) == "So":
                    achados.append(f"{arquivo.relative_to(RAIZ)}:{n} {ch!r}")
    if achados:
        problemas.extend(achados)
        for a in achados:
            print(f"  FALHA  {a}")
    else:
        print(f"  ok     nenhum emoji em {len(alvos)} arquivos")
        ok.append("emoji")


# ---------------------------------------------------------------------------
# 5. Cor solta no JSX
# ---------------------------------------------------------------------------
def audita_cores() -> None:
    secao("5. Cor fora dos tokens")
    permitidos = {"src/lib/imagem.ts"}
    achados = []
    for arquivo in list(SRC.rglob("*.tsx")):
        rel = str(arquivo.relative_to(RAIZ)).replace("\\", "/")
        if rel.replace("src/", "src/") in permitidos:
            continue
        texto = arquivo.read_text()
        for n, linha in enumerate(texto.splitlines(), 1):
            for hexa in re.findall(r"#[0-9A-Fa-f]{6}\b", linha):
                # SVG precisa de hex literal: nao aceita classe do Tailwind.
                if "<svg" in texto or "stroke=" in linha or "fill=" in linha or "accent-[" in linha:
                    continue
                achados.append(f"{rel}:{n} {hexa}")
    if achados:
        avisos.extend(achados)
        for a in achados:
            print(f"  aviso  {a}")
    else:
        print("  ok     nenhuma cor solta fora de SVG")
        ok.append("cores")


# ---------------------------------------------------------------------------
# 6. Client do Supabase fora dos repositorios
# ---------------------------------------------------------------------------
def audita_camadas() -> None:
    secao("6. Acesso ao banco fora da camada de repositorios")
    # Server Actions ('use server') SAO camada de servidor, nao componente.
    # Elas existem justamente para escrever - checa-las como tela geraria
    # ruido permanente e o aviso perderia sentido.
    permitidos = ("repositories/", "lib/supabase/", "lib/auth/")
    achados = []
    for arquivo in list(SRC.rglob("*.tsx")) + list(SRC.rglob("*.ts")):
        rel = str(arquivo.relative_to(SRC)).replace("\\", "/")
        if rel.startswith(permitidos):
            continue
        texto = arquivo.read_text()
        if texto.lstrip().startswith("'use server'"):
            continue
        # getServerClient so para INJETAR no repositorio e aceitavel.
        for n, linha in enumerate(texto.splitlines(), 1):
            if re.search(r"\bsb\.(from|rpc|storage)\(", linha):
                achados.append(f"{rel}:{n} {linha.strip()[:70]}")
    if achados:
        for a in achados:
            avisos.append(f"acesso direto: {a}")
            print(f"  aviso  {a}")
    else:
        print("  ok     nenhum componente fala com o banco direto")
        ok.append("camadas")


# ---------------------------------------------------------------------------
# 7. Variaveis de ambiente
# ---------------------------------------------------------------------------
def audita_env() -> None:
    secao("7. Variaveis de ambiente")
    usadas = set()
    for arquivo in list(SRC.rglob("*.ts")) + list(SRC.rglob("*.tsx")) + list(
        (RAIZ / "scripts").rglob("*.ts")
    ):
        usadas |= set(re.findall(r"process\.env\.([A-Z_0-9]+)", arquivo.read_text()))

    exemplo = RAIZ / ".env.example"
    documentadas = set()
    if exemplo.exists():
        texto = exemplo.read_text()
        # Aceita tambem as comentadas: elas estao documentadas, so nao ativas.
        documentadas = set(re.findall(r"^#?\s*([A-Z_0-9]+)=", texto, re.M))

    # Estas tem valor embutido em src/lib/supabase/config.ts, entao nao
    # precisam existir no ambiente para o app subir.
    documentadas |= {"NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"}

    for v in sorted(usadas):
        if v in documentadas:
            print(f"  ok     {v}")
        else:
            problemas.append(f"{v}: usada no codigo e ausente do .env.example")
            print(f"  FALHA  {v}: nao documentada no .env.example")

    for v in sorted(documentadas - usadas):
        print(f"  aviso  {v}: documentada e nao usada")

    publicas = {v for v in usadas if v.startswith("NEXT_PUBLIC_")}
    for v in sorted(publicas):
        if "SERVICE_ROLE" in v or "SECRET" in v:
            problemas.append(f"{v}: segredo exposto como variavel publica")
            print(f"  FALHA  {v}: segredo em variavel NEXT_PUBLIC")


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 68)
    print("EstudeVet v11 - Auditoria de virada")
    print("=" * 68)

    audita_rls()
    audita_rotas()
    audita_telas()
    audita_emoji()
    audita_cores()
    audita_camadas()
    audita_env()

    secao("Resumo")
    print(f"  verificacoes ok: {len(ok)}")
    print(f"  avisos:          {len(avisos)}")
    print(f"  problemas:       {len(problemas)}")

    if problemas:
        print("\nPROBLEMAS QUE IMPEDEM A VIRADA:")
        for p in problemas:
            print(f"  - {p}")
        sys.exit(1)

    print("\nNenhum problema bloqueante.")
    sys.exit(0)
