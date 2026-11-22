#!/usr/bin/env python3
"""
Resalta el codigo de docs/guia-defensa.html con la paleta Dark+ de VS Code.

El HTML queda con los tokens ya resueltos en <span>: no hay JavaScript, no
depende de la red y el service worker lo cachea como cualquier otro HTML.

Uso:
    python tools/resaltar-guia.py                 # escribe docs/guia-defensa.html
    python tools/resaltar-guia.py --check         # solo informa, no escribe
    python tools/resaltar-guia.py --out otro.html

Se puede correr las veces que haga falta: cada bloque se vuelve a tokenizar
desde su texto plano, asi que los spans viejos no se acumulan.
"""

from __future__ import annotations

import argparse
import html
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DOC = RAIZ / 'docs' / 'guia-defensa.html'

MARCA_INI = '/* == RESALTADO VS CODE DARK+ == */'
MARCA_FIN = '/* == FIN RESALTADO == */'

# ---------------------------------------------------------------------------
# Paletas: valores exactos de VS Code Dark+ (el fondo del codigo ya es oscuro
# en los dos temas de la guia, asi que alcanza con una sola paleta).
# ---------------------------------------------------------------------------

CSS = MARCA_INI + """
.code pre code{--c-com:#6a9955;--c-str:#ce9178;--c-num:#b5cea8;--c-kw:#569cd6;
  --c-ctl:#c586c0;--c-fn:#dcdcaa;--c-typ:#4ec9b0;--c-var:#9cdcfe;}
.code .t-com{color:var(--c-com)}
.code .t-str{color:var(--c-str)}
.code .t-num{color:var(--c-num)}
.code .t-kw{color:var(--c-kw)}
.code .t-ctl{color:var(--c-ctl)}
.code .t-fn{color:var(--c-fn)}
.code .t-typ{color:var(--c-typ)}
.code .t-var{color:var(--c-var)}
.code .cm{color:var(--c-com)}
""" + MARCA_FIN

# ---------------------------------------------------------------------------
# Lexico TypeScript / JavaScript
# ---------------------------------------------------------------------------

CTL = {
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
    'continue', 'return', 'throw', 'try', 'catch', 'finally', 'await', 'yield',
    'in', 'of', 'instanceof', 'typeof', 'void', 'delete',
}
KW = {
    'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum',
    'import', 'export', 'from', 'as', 'async', 'extends', 'implements',
    'readonly', 'public', 'private', 'protected', 'static', 'new', 'this',
    'super', 'true', 'false', 'null', 'undefined', 'get', 'set', 'declare',
    'namespace', 'satisfies', 'keyof', 'is',
}
TIPOS = {'string', 'number', 'boolean', 'any', 'unknown', 'never', 'object', 'symbol', 'bigint'}
TIPOS_MAYUS = {'Map', 'Set', 'Date', 'Promise', 'Array', 'Error', 'RegExp', 'Symbol', 'Record', 'Partial'}
BUILTIN_FN = {'Number', 'String', 'Boolean', 'Object', 'Array', 'Symbol', 'BigInt'}

IDENT = re.compile(r'[A-Za-z_$][A-Za-z0-9_$]*')
NUM = re.compile(r'0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?')

# Caracteres que habilitan un literal de expresion regular.
ANTES_REGEX = {None, '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', 'return', '=>'}


def _clase_palabra(palabra: str, resto: str) -> str:
    if palabra in CTL:
        return 'ctl'
    if palabra in KW:
        return 'kw'
    if palabra in TIPOS:
        return 'kw'
    siguiente = re.match(r'\s*(\S)', resto)
    prox = siguiente.group(1) if siguiente else ''
    if prox == '(' and palabra in BUILTIN_FN:
        return 'fn'
    if palabra[0].isupper() and (any(c.islower() for c in palabra) or palabra in TIPOS_MAYUS):
        return 'typ'
    if prox == '(':
        return 'fn'
    return 'var'


def _regex(src: str, i: int):
    """Devuelve el final de un literal /.../ si en i empieza uno."""
    j = i + 1
    n = len(src)
    if j < n and src[j] in '/*':
        return None
    dentro_clase = False
    while j < n:
        c = src[j]
        if c == '\\':
            j += 2
            continue
        if c == '\n':
            return None
        if c == '[':
            dentro_clase = True
        elif c == ']':
            dentro_clase = False
        elif c == '/' and not dentro_clase:
            j += 1
            while j < n and src[j].isalpha():
                j += 1
            return j
        j += 1
    return None


def lex_ts(src: str, dentro_plantilla: bool = False):
    """Devuelve [(clase, texto)] y el indice donde corto (para plantillas)."""
    salida = []
    i, n = 0, len(src)
    previo = None

    def emitir(clase, texto):
        if texto:
            salida.append((clase, texto))

    while i < n:
        c = src[i]

        if c in ' \t\n\r':
            j = i
            while j < n and src[j] in ' \t\n\r':
                j += 1
            emitir('txt', src[i:j])
            i = j
            continue

        if src.startswith('//', i):
            j = src.find('\n', i)
            j = n if j < 0 else j
            emitir('com', src[i:j])
            i = j
            continue

        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            j = n if j < 0 else j + 2
            emitir('com', src[i:j])
            i = j
            continue

        if c in '"\'':
            j = i + 1
            while j < n:
                if src[j] == '\\':
                    j += 2
                    continue
                if src[j] == c:
                    j += 1
                    break
                if src[j] == '\n':
                    break
                j += 1
            emitir('str', src[i:j])
            i = j
            previo = 'str'
            continue

        if c == '`':
            # sql`...` es SQL embebido: adentro va la paleta de SQL, igual que
            # en VS Code con la gramatica inyectada.
            es_sql = previo == 'sql'
            emitir('str', '`')
            i += 1
            inicio = i
            while i < n:
                if src[i] == '\\':
                    i += 2
                    continue
                if src.startswith('${', i):
                    trozo = src[inicio:i]
                    if es_sql:
                        for clase, texto in lex_sql(trozo):
                            emitir(clase, texto)
                    else:
                        emitir('str', trozo)
                    j = i + 2
                    prof = 1
                    while j < n and prof:
                        if src[j] == '{':
                            prof += 1
                        elif src[j] == '}':
                            prof -= 1
                        j += 1
                    emitir('txt', '${')
                    for clase, texto in lex_ts(src[i + 2:j - 1], True):
                        emitir(clase, texto)
                    emitir('txt', '}')
                    i = j
                    inicio = i
                    continue
                if src[i] == '`':
                    break
                i += 1
            trozo = src[inicio:i]
            if es_sql:
                for clase, texto in lex_sql(trozo):
                    emitir(clase, texto)
            else:
                emitir('str', trozo)
            emitir('str', '`')
            i += 1
            previo = 'template'
            continue

        if c.isdigit():
            m = NUM.match(src, i)
            if m:
                emitir('num', m.group())
                i = m.end()
                previo = 'num'
                continue

        m = IDENT.match(src, i)
        if m:
            palabra = m.group()
            clase = _clase_palabra(palabra, src[m.end():])
            emitir(clase, palabra)
            previo = 'sql' if palabra == 'sql' else palabra
            i = m.end()
            continue

        if c == '/' and previo in ANTES_REGEX:
            fin = _regex(src, i)
            if fin:
                emitir('str', src[i:fin])
                i = fin
                previo = 'regex'
                continue

        emitir('txt', c)
        if c == '(' or c == ',':
            previo = c
        elif not c.isspace():
            previo = c
        i += 1

    return salida


# ---------------------------------------------------------------------------
# Lexico SQL
# ---------------------------------------------------------------------------

SQL_KW = {
    'select', 'from', 'where', 'insert', 'update', 'delete', 'into', 'values',
    'set', 'join', 'left', 'right', 'inner', 'outer', 'on', 'and', 'or', 'not',
    'is', 'null', 'order', 'by', 'group', 'having', 'limit', 'offset', 'as',
    'create', 'table', 'alter', 'add', 'column', 'drop', 'index', 'unique',
    'primary', 'key', 'references', 'foreign', 'default', 'check', 'begin',
    'commit', 'rollback', 'transaction', 'case', 'when', 'then', 'else', 'end',
    'distinct', 'asc', 'desc', 'union', 'all', 'exists', 'between', 'like',
    'count', 'sum', 'coalesce', 'cast', 'integer', 'text', 'real', 'blob',
    'numeric', 'boolean', 'varchar', 'timestamp', 'pragma', 'explain',
}
SQL_FN = {'count', 'sum', 'coalesce', 'cast', 'max', 'min', 'avg', 'ifnull', 'printf'}


def lex_sql(src: str, salida=None):
    propia = salida is None
    if propia:
        salida = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if c in ' \t\n\r':
            j = i
            while j < n and src[j] in ' \t\n\r':
                j += 1
            salida.append(('txt', src[i:j]))
            i = j
            continue
        if src.startswith('--', i):
            j = src.find('\n', i)
            j = n if j < 0 else j
            salida.append(('com', src[i:j]))
            i = j
            continue
        if c in '"\'':
            j = i + 1
            while j < n:
                if src[j] == '\\':
                    j += 2
                    continue
                if src[j] == c:
                    j += 1
                    break
                j += 1
            salida.append(('str', src[i:j]))
            i = j
            continue
        if c.isdigit():
            m = NUM.match(src, i)
            salida.append(('num', m.group()))
            i = m.end()
            continue
        m = IDENT.match(src, i)
        if m:
            palabra = m.group()
            baja = palabra.lower()
            if baja in SQL_KW:
                clase = 'fn' if baja in SQL_FN else 'kw'
            else:
                clase = 'var'
            salida.append((clase, palabra))
            i = m.end()
            continue
        salida.append(('txt', c))
        i += 1
    return salida


# ---------------------------------------------------------------------------
# Lexico JSON
# ---------------------------------------------------------------------------

def lex_json(src: str):
    salida = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if c in ' \t\n\r':
            j = i
            while j < n and src[j] in ' \t\n\r':
                j += 1
            salida.append(('txt', src[i:j]))
            i = j
            continue
        if c == '"':
            j = i + 1
            while j < n:
                if src[j] == '\\':
                    j += 2
                    continue
                if src[j] == '"':
                    j += 1
                    break
                j += 1
            resto = src[j:]
            clase = 'var' if re.match(r'\s*:', resto) else 'str'
            salida.append((clase, src[i:j]))
            i = j
            continue
        if c.isdigit() or (c == '-' and i + 1 < n and src[i + 1].isdigit()):
            m = NUM.match(src, i + (1 if c == '-' else 0))
            fin = m.end()
            salida.append(('num', src[i:fin]))
            i = fin
            continue
        m = IDENT.match(src, i)
        if m:
            palabra = m.group()
            salida.append(('kw', palabra))
            i = m.end()
            continue
        salida.append(('txt', c))
        i += 1
    return salida


# ---------------------------------------------------------------------------
# Lexico shell / .env
# ---------------------------------------------------------------------------

def lex_shell(src: str):
    salida = []
    i, n = 0, len(src)
    inicio_linea = True
    while i < n:
        c = src[i]
        if c == '\n':
            salida.append(('txt', c))
            i += 1
            inicio_linea = True
            continue
        if c in ' \t':
            j = i
            while j < n and src[j] in ' \t':
                j += 1
            salida.append(('txt', src[i:j]))
            i = j
            continue
        if c == '#' and (inicio_linea or src[i - 1] in ' \t'):
            j = src.find('\n', i)
            j = n if j < 0 else j
            salida.append(('com', src[i:j]))
            i = j
            continue
        if c in '"\'':
            j = i + 1
            while j < n:
                if src[j] == '\\' and c == '"':
                    j += 2
                    continue
                if src[j] == c:
                    j += 1
                    break
                j += 1
            salida.append(('str', src[i:j]))
            i = j
            inicio_linea = False
            continue
        if c == '$':
            m = re.match(r'\$env:[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*', src[i:])
            if m:
                salida.append(('var', m.group()))
                i += len(m.group())
                inicio_linea = False
                continue
        m = re.match(r'--?[A-Za-z][\w-]*', src[i:])
        if m and (i == 0 or src[i - 1] in ' \t'):
            salida.append(('var', m.group()))
            i += len(m.group())
            inicio_linea = False
            continue
        m = re.match(r'[A-Za-z_./][\w./:-]*', src[i:])
        if m:
            palabra = m.group()
            clase = 'fn' if inicio_linea else 'txt'
            salida.append((clase, palabra))
            i += len(palabra)
            inicio_linea = False
            continue
        if c.isdigit():
            m = NUM.match(src, i)
            salida.append(('num', m.group()))
            i = m.end()
            continue
        salida.append(('txt', c))
        i += 1
        if c not in ' |&':
            inicio_linea = False
    return salida


def lex_env(src: str):
    salida = []
    for linea in src.splitlines(keepends=True):
        cuerpo = linea.rstrip('\n')
        if cuerpo.lstrip().startswith('#'):
            salida.append(('com', cuerpo))
            salida.append(('txt', linea[len(cuerpo):]))
            continue
        m = re.match(r'([A-Za-z_][A-Za-z0-9_]*)(=)(.*)', cuerpo)
        if m:
            salida.append(('var', m.group(1)))
            salida.append(('txt', '='))
            valor = m.group(3)
            if valor.startswith('"') or valor.startswith("'"):
                salida.append(('str', valor))
            elif valor:
                salida.append(('txt', valor))
            salida.append(('txt', linea[len(cuerpo):]))
            continue
        salida.append(('txt', linea))
    return salida


# ---------------------------------------------------------------------------
# Deteccion de lenguaje
# ---------------------------------------------------------------------------

def detectar(texto: str) -> str:
    lineas = [l for l in texto.splitlines() if l.strip()]
    if not lineas:
        return 'txt'
    sin_comentarios = [l for l in lineas if not l.lstrip().startswith('#')]
    if sin_comentarios and all(re.match(r'^[A-Za-z_][A-Za-z0-9_]*=', l) for l in sin_comentarios):
        return 'env'
    cabeza = lineas[0].lstrip()
    if cabeza[0] in '{[' and re.search(r'"\s*:', texto) and not re.search(
        r'\b(const|import|export|function|return|await)\b', texto
    ):
        return 'json'
    comando = re.match(r'^(pnpm|curl|turso|cp |\$env:|\w+ --?|node -e|git |npx )', cabeza)
    if cabeza.startswith('#') or comando:
        return 'shell'
    if not re.search(r'\b(const|import|export|function|return|await|throw)\b', texto) and re.search(
        r'(?i)\b(select|insert into|update|delete from|create table)\b', texto
    ):
        return 'sql'
    return 'ts'


LEXERS = {'ts': lex_ts, 'json': lex_json, 'sql': lex_sql, 'shell': lex_shell, 'env': lex_env}
NOMBRES = {'ts': 'ts', 'json': 'json', 'sql': 'sql', 'shell': 'bash', 'env': 'dotenv'}


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

def render(bloque: list) -> str:
    partes = []
    clase_actual = None
    buffer = []

    def volcar():
        if not buffer:
            return
        texto = html.escape(''.join(buffer), quote=False)
        if clase_actual and clase_actual != 'txt':
            partes.append('<span class="t-%s">%s</span>' % (clase_actual, texto))
        else:
            partes.append(texto)

    for clase, texto in bloque:
        if clase == clase_actual:
            buffer.append(texto)
        else:
            volcar()
            clase_actual = clase
            buffer = [texto]
    volcar()
    return ''.join(partes)


def texto_de(html_bloque: str) -> str:
    limpio = re.sub(r'<[^>]+>', '', html_bloque)
    return html.unescape(limpio)


def resaltar_bloque(m, stats):
    contenido = texto_de(m.group(2))
    lenguaje = detectar(contenido)
    stats[lenguaje] = stats.get(lenguaje, 0) + 1
    tokens = LEXERS[lenguaje](contenido)
    # garantia: el texto visible no cambia
    if ''.join(t for _, t in tokens) != contenido:
        raise SystemExit('El tokenizador perdio texto:\n%r' % contenido[:200])
    cuerpo = render(tokens)
    return '%s<code class="lang-%s" data-lang="%s">%s</code></pre>' % (
        m.group(1), NOMBRES[lenguaje], NOMBRES[lenguaje], cuerpo
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--out')
    args = ap.parse_args()

    destino = pathlib.Path(args.out) if args.out else DOC
    s = DOC.read_text(encoding='utf-8')

    s = re.sub(re.escape(MARCA_INI) + r'.*?' + re.escape(MARCA_FIN) + r'\n?', '', s, flags=re.S)
    s = s.replace('</style>', CSS + '\n</style>', 1)

    stats = {}
    patron = re.compile(r'(<pre[^>]*>)(.*?)</pre>', re.S)
    nuevo, total = patron.subn(lambda m: resaltar_bloque(m, stats), s)

    print('bloques', total, dict(sorted(stats.items())))
    print('bytes', len(nuevo.encode('utf-8')))
    if args.check:
        return
    destino.write_text(nuevo, encoding='utf-8')


if __name__ == '__main__':
    main()
