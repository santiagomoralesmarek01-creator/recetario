"""Arma el catálogo de TheMealDB en español.

Entrada (data/fuente/):
  mealdb-en.json        catálogo original (lo baja descargar-mealdb.mjs)
  nombres-es.json       nombres de recetas traducidos a mano
  ingredientes-es.json  ingredientes traducidos a mano
  pasos-es.json         caché de pasos ya traducidos (se completa solo)

Salida:
  data/mealdb/indice.json     lo necesario para listar y buscar (liviano)
  data/mealdb/<id>.json       detalle de cada receta

Los pasos se traducen con Argos Translate (libre, corre sin conexión a
ninguna API) y después se pasan por un glosario rioplatense. Un paso ya
traducido no se vuelve a traducir: queda guardado en pasos-es.json, y si
alguien lo corrige a mano ahí, la corrección se respeta.
"""
import hashlib
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from medidas import traducir_medida  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "data" / "fuente"
SALIDA = RAIZ / "data" / "mealdb"
FRAGMENTOS = RAIZ / "fragmentos-traduccion"

ORIGENES = {
    "": "", "Algerian": "Argelia", "Argentina": "Argentina", "Australian": "Australia", "British": "Reino Unido",
    "Canadian": "Canadá", "Chinese": "China", "Croatian": "Croacia", "Egyptian": "Egipto", "Filipino": "Filipinas",
    "France": "Francia", "Greek": "Grecia", "India": "India", "Irish": "Irlanda", "Italian": "Italia",
    "Jamaican": "Jamaica", "Japanese": "Japón", "Kenyan": "Kenia", "Malaysian": "Malasia", "Mexican": "México",
    "Moroccan": "Marruecos", "Netherlands": "Países Bajos", "Norway": "Noruega", "Polish": "Polonia",
    "Portuguese": "Portugal", "Russian": "Rusia", "Saudi Arabian": "Arabia Saudita", "Slovakia": "Eslovaquia",
    "Spanish": "España", "Syrian": "Siria", "Thai": "Tailandia", "Tunisian": "Túnez", "Turkish": "Turquía",
    "Ukrainian": "Ucrania", "United States": "Estados Unidos", "Uruguayan": "Uruguay", "Venezuela": "Venezuela",
    "Vietnamese": "Vietnam",
}

ETIQUETAS = {
    "soup": "Sopa", "desert": "Postre", "dessert": "Postre", "baking": "Horno", "meat": "Carne", "pie": "Pastel",
    "cake": "Torta", "breakfast": "Desayuno", "pudding": "Budín", "snack": "Snack", "sweet": "Dulce", "treat": "Gustito",
    "fruity": "Frutal", "pasta": "Pasta", "curry": "Curry", "tart": "Tarta", "vegetarian": "Vegetariano",
    "speciality": "Especialidad", "spicy": "Picante", "fish": "Pescado", "dairy": "Lácteos", "alcoholic": "Con alcohol",
    "bbq": "Parrilla", "seafood": "Mariscos", "chocolate": "Chocolate", "cheesy": "Con queso", "cheasy": "Con queso",
    "mainmeal": "Plato principal", "sidedish": "Guarnición", "stew": "Guiso", "brunch": "Brunch", "nutty": "Frutos secos",
    "egg": "Huevo", "shellfish": "Mariscos", "pulse": "Legumbres", "unhealthy": "Pecado", "calorific": "Contundente",
    "dinnerparty": "Para invitados", "christmas": "Navidad", "casserole": "Cazuela", "vegan": "Vegano",
    "savory": "Salado", "hangoverfood": "Para la resaca", "bun": "Bollo", "light": "Liviano", "summer": "Verano",
    "warm": "Caliente", "warming": "Reconfortante", "datenight": "Cita", "halloween": "Halloween",
    "haloween": "Halloween", "chilli": "Picante", "glazed": "Glaseado", "paleo": "Paleo", "keto": "Keto",
    "lowcarbs": "Bajo en carbohidratos", "salad": "Ensalada", "mild": "Suave", "sour": "Ácido",
    "lowcalorie": "Bajo en calorías", "greasy": "Contundente", "heavy": "Contundente", "caramel": "Caramelo",
    "vegetables": "Verduras", "strongflavor": "Sabor intenso", "expensive": "Especial", "paella": "Paella",
    "easter": "Pascua", "highfat": "Contundente", "fusion": "Fusión", "sandwich": "Sándwich", "cheap": "Económico",
    "sausages": "Salchichas", "beans": "Legumbres", "streetfood": "Comida callejera", "onthego": "Para llevar",
    "fresh": "Fresco", "pancake": "Panqueque", "kebab": "Kebab", "celebration": "Festejo", "party": "Fiesta",
    "eid": "Eid",
}

# Glosario rioplatense aplicado sobre la traducción automática.
GLOSARIO = [
    (r"\bmantequilla\b", "manteca"), (r"\bpatatas\b", "papas"), (r"\bpatata\b", "papa"),
    (r"\bnata\b", "crema"), (r"\bjudías verdes\b", "chauchas"), (r"\bguisantes\b", "arvejas"), (r"\bguisante\b", "arveja"),
    (r"\bcalabacines\b", "zucchinis"), (r"\bcalabacín\b", "zucchini"), (r"\bpimientos\b", "morrones"),
    (r"\bpimiento\b", "morrón"), (r"\bfresas\b", "frutillas"), (r"\bfresa\b", "frutilla"),
    (r"\bmelocotones\b", "duraznos"), (r"\bmelocotón\b", "durazno"), (r"\balbaricoques\b", "damascos"),
    (r"\balbaricoque\b", "damasco"), (r"\baguacates\b", "paltas"), (r"\baguacate\b", "palta"),
    (r"\bcacahuetes\b", "maníes"), (r"\bcacahuete\b", "maní"), (r"\bcacahuates\b", "maníes"), (r"\bcacahuate\b", "maní"),
    (r"\bzumo\b", "jugo"), (r"\bpiña\b", "ananá"), (r"\bgambas\b", "langostinos"), (r"\bgamba\b", "langostino"),
    (r"\btocino\b", "panceta"), (r"\bbeicon\b", "panceta"), (r"\bfrijoles\b", "porotos"), (r"\bfrijol\b", "poroto"),
    (r"\balubias\b", "porotos"), (r"\bjudías\b", "porotos"), (r"\bazúcar glas\b", "azúcar impalpable"),
    (r"\bnevera\b", "heladera"), (r"\bfrigorífico\b", "heladera"), (r"\brefrigerador\b", "heladera"),
    (r"\bmaíz dulce\b", "choclo"), (r"\bcebolletas\b", "cebollas de verdeo"), (r"\bcebolleta\b", "cebolla de verdeo"),
    (r"\bcoger\b", "tomar"), (r"\bcoja\b", "tome"), (r"\bcoge\b", "toma"),
    (r"\bmasa quebrada\b", "masa para tarta"), (r"\bhornear en el horno\b", "hornear"),
]


# Verbos que Argos a veces deja en inglés al principio de una oración.
VERBOS = {
    "boil": "hervir", "fry": "freír", "mash": "pisar", "simmer": "cocinar a fuego lento", "slice": "cortar en rodajas",
    "drain": "escurrir", "stir": "revolver", "grill": "grillar", "knead": "amasar", "whisk": "batir", "chop": "picar",
    "bake": "hornear", "roast": "asar", "toss": "mezclar", "season": "condimentar", "preheat": "precalentar",
    "sauté": "saltear", "saute": "saltear", "blend": "licuar", "sift": "tamizar", "grate": "rallar",
}

# Correcciones de términos que la traducción automática confunde (sensibles a mayúsculas: "Chile" es el país).
TERMINOS = [
    (r"\buna (?:lata|bandeja) (?:de|para) (?:hornear|horneado|pastel|torta|pan)\b", "un molde"),
    (r"\b[Ll]as langostinos\b", "los langostinos"), (r"\b[Uu]nas langostinos\b", "unos langostinos"),
    (r"\b[Ll]a langostino\b", "el langostino"),
    (r"\b(lata|bandeja|molde) (?:de|para) (?:hornear|horneado|pastel|torta|pan)\b", "molde"),
    (r"\b(?:hoja|bandeja) (?:de|para) (?:hornear|horneado|galletas)\b", "placa para horno"),
    (r"\bpapel (?:de )?pergamino\b|\bpergamino(?: para hornear)?\b", "papel manteca"),
    (r"\bcebollas de primavera\b", "cebollas de verdeo"), (r"\bcebolla de primavera\b", "cebolla de verdeo"),
    (r"\bazúcar de hielo\b|\bazúcar glaseado\b", "azúcar impalpable"), (r"\bcrema doble\b", "crema de leche"),
    (r"\balcantarillas\b", "brochetas"), (r"\balcantarilla\b", "brocheta"),
    (r"\bchiles\b", "ajíes"), (r"\bchile\b", "ají"),
]


def pulir(texto):
    """Arreglos finales sobre la traducción: temperaturas, verbos en inglés y términos."""
    # "180C/160C ventilador/gas 4" -> "180 °C"
    texto = re.sub(r"(\d{2,3})\s*[°ºo]?\s*C\s*/\s*\d{2,3}\s*[°ºo]?\s*C\s*(?:ventilador|fan|ventilado|con ventilador)?"
                   r"\s*/\s*(?:marca de )?gas\s*(?:marca\s*)?\d+(?:\s*/\s*\d+)?", r"\1 °C", texto, flags=re.I)
    texto = re.sub(r"(\d{2,3})\s*[°ºo]?\s*C\s*/\s*(?:marca de )?gas\s*(?:marca\s*)?\d+", r"\1 °C", texto, flags=re.I)
    # "350°F (175°C)" -> "175 °C"; "350F" -> "175 °C"
    texto = re.sub(r"(\d{3})\s*[°º]?\s*F\s*\(\s*(\d{2,3})\s*[°º]?\s*C\s*\)", r"\2 °C", texto)
    texto = re.sub(r"(\d{3})\s*[°º]?\s*(?:grados\s*)?F\b",
                   lambda m: f"{int(round((int(m.group(1)) - 32) * 5 / 9 / 5) * 5)} °C", texto)
    texto = re.sub(r"(\d)\s*[°º]\s*C\b|(\d)\s?C\b", lambda m: f"{m.group(1) or m.group(2)} °C", texto)
    texto = re.sub(r"\b(" + "|".join(VERBOS) + r")\b", lambda m: con_mayuscula(m.group(0), VERBOS[m.group(0).lower()]),
                   texto, flags=re.I)
    for patron, reemplazo in TERMINOS:
        texto = re.sub(patron, lambda m, r=reemplazo: con_mayuscula(m.group(0), r), texto)
    return texto


def con_mayuscula(original, reemplazo):
    return reemplazo[:1].upper() + reemplazo[1:] if original[:1].isupper() else reemplazo


def aplicar_glosario(texto):
    for patron, reemplazo in GLOSARIO:
        texto = re.sub(patron, lambda m, r=reemplazo: con_mayuscula(m.group(0), r), texto, flags=re.IGNORECASE)
    return texto


def separar_pasos(texto):
    """Mismo criterio que la web: una línea por paso, sin rótulos "STEP 1"."""
    pasos = []
    for linea in re.split(r"\r?\n+", texto or ""):
        linea = re.sub(r"^\s*(step\s*)?\d+[.):-]?\s*", "", linea, flags=re.I).strip()
        if len(linea) > 1:
            pasos.append(linea)
    # Recetas escritas en un solo párrafo largo: se parten en oraciones (de a dos).
    if len(pasos) <= 2 and sum(len(p) for p in pasos) > 400:
        oraciones = [o.strip() for p in pasos for o in re.split(r"(?<=[.!?])\s+(?=[A-Z])", p) if o.strip()]
        pasos = [" ".join(oraciones[i:i + 2]) for i in range(0, len(oraciones), 2)]
    return pasos


def clave(texto):
    return hashlib.sha1(texto.encode("utf-8")).hexdigest()[:16]


def cargar_traductor():
    import argostranslate.package
    import argostranslate.translate

    instalados = argostranslate.translate.get_installed_languages()
    if not any(l.code == "en" for l in instalados) or not any(l.code == "es" for l in instalados):
        argostranslate.package.update_package_index()
        paquete = next(p for p in argostranslate.package.get_available_packages()
                       if p.from_code == "en" and p.to_code == "es")
        argostranslate.package.install_from_path(paquete.download())
    return lambda texto: argostranslate.translate.translate(texto, "en", "es")


def pasos_pendientes(catalogo, cache):
    pendientes = {}
    for receta in catalogo["recetas"]:
        for paso in separar_pasos(receta["instrucciones"]):
            if clave(paso) not in cache:
                pendientes[clave(paso)] = paso
    return dict(sorted(pendientes.items()))


def guardar_json(ruta, datos):
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=0, sort_keys=True))


def traducir_fragmento(catalogo, cache, numero, total):
    """Traduce sólo la parte `numero` de `total` de los pasos pendientes (para correr en paralelo)."""
    pendientes = list(pasos_pendientes(catalogo, cache).items())[numero::total]
    print(f"Fragmento {numero + 1}/{total}: {len(pendientes)} pasos", flush=True)
    FRAGMENTOS.mkdir(parents=True, exist_ok=True)
    salida = FRAGMENTOS / f"pasos-{numero}.json"
    traducidos = {}
    traducir = cargar_traductor()
    for n, (k, paso) in enumerate(pendientes, 1):
        traducidos[k] = aplicar_glosario(traducir(paso))
        if n % 50 == 0:
            print(f"  {n}/{len(pendientes)}", flush=True)
            guardar_json(salida, traducidos)
    guardar_json(salida, traducidos)


def armar(catalogo, cache):
    nombres = json.loads((FUENTE / "nombres-es.json").read_text())
    ingredientes = json.loads((FUENTE / "ingredientes-es.json").read_text())
    # TheMealDB no trae el país de algunas recetas: se completa a mano acá.
    origenes = json.loads((FUENTE / "origenes-es.json").read_text())
    # Traducciones de pasos revisadas a mano: tienen prioridad sobre las automáticas.
    revisados = {}
    for f in sorted((FUENTE / "pasos-revisados").glob("*.json")):
        revisados.update(json.loads(f.read_text()))
    SALIDA.mkdir(parents=True, exist_ok=True)
    for viejo in SALIDA.glob("*.json"):
        viejo.unlink()

    indice = []
    sin_traducir = 0
    for receta in catalogo["recetas"]:
        rid = receta["id"]
        ings = [[ingredientes[n.lower()], traducir_medida(m), n] for n, m in receta["ingredientes"]]
        pasos_en = separar_pasos(receta["instrucciones"])
        pasos = [revisados.get(clave(p)) or (pulir(aplicar_glosario(cache[clave(p)])) if clave(p) in cache else p)
                 for p in pasos_en]
        faltan = any(clave(p) not in cache and clave(p) not in revisados for p in pasos_en)
        sin_traducir += faltan
        detalle = {
            "id": rid,
            "nombre": nombres[rid],
            "original": receta["nombre"],
            "categoria": receta["categoria"],
            "origen": origenes.get(rid) or ORIGENES.get(receta["origen"], receta["origen"]),
            "imagen": receta["imagen"],
            "video": receta["video"],
            "enlace": receta["enlace"],
            "etiquetas": sorted({ETIQUETAS[t.lower()] for t in receta["etiquetas"] if t.lower() in ETIQUETAS}),
            "ingredientes": ings,
            "pasos": pasos,
        }
        if faltan:
            detalle["pasosEnIngles"] = True
        (SALIDA / f"{rid}.json").write_text(json.dumps(detalle, ensure_ascii=False, separators=(",", ":")))
        indice.append([rid, nombres[rid], receta["categoria"], detalle["origen"], receta["imagen"],
                       "|".join(i[0] for i in ings)])

    categorias = [{"nombre": c["nombre"], "imagen": c["imagen"]} for c in catalogo["categorias"]]
    (SALIDA / "indice.json").write_text(json.dumps(
        {"campos": ["id", "nombre", "categoria", "origen", "imagen", "ingredientes"],
         "categorias": categorias, "recetas": indice},
        ensure_ascii=False, separators=(",", ":")))
    total_pasos = sum(len(separar_pasos(r["instrucciones"])) for r in catalogo["recetas"])
    print(f"Listo: {len(indice)} recetas en {SALIDA.relative_to(RAIZ)} ({sin_traducir} con pasos aún en inglés;"
          f" {len(revisados)} pasos revisados a mano de ~{total_pasos})")
    armar_ingredientes(catalogo, ingredientes)


def armar_ingredientes(catalogo, ingredientes):
    """data/ingredientes.json: [nombre en español, clave de imagen, cantidad de recetas que lo usan].
    Lo usa el buscador de ingredientes del formulario de recetas propias."""
    lista = {}
    for receta in catalogo["recetas"]:
        for nombre_en, _ in receta["ingredientes"]:
            es = ingredientes[nombre_en.lower()]
            item = lista.setdefault(es.lower(), [es, nombre_en, 0])
            item[2] += 1
    casa = json.loads((RAIZ / "data" / "recetas-casa.json").read_text())
    for receta in casa:
        for ing in receta["ingredientes"]:
            item = lista.setdefault(ing["nombre"].lower(), [ing["nombre"], ing.get("imagen", ""), 0])
            item[2] += 1
            if not item[1] and ing.get("imagen"):
                item[1] = ing["imagen"]
    ordenada = sorted(lista.values(), key=lambda i: (-i[2], i[0]))
    (RAIZ / "data" / "ingredientes.json").write_text(json.dumps(ordenada, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(ordenada)} ingredientes en data/ingredientes.json")


def main():
    """
    Sin argumentos: suma los fragmentos traducidos a la caché y arma data/mealdb/.
    Los pasos que todavía no estén traducidos quedan en inglés (marcados).
    Con --fragmento N/TOTAL: traduce esa parte de los pasos pendientes.
    Con TRADUCIR=1: además traduce acá mismo todo lo que falte antes de armar.
    """
    catalogo = json.loads((FUENTE / "mealdb-en.json").read_text())
    ruta_cache = FUENTE / "pasos-es.json"
    cache = json.loads(ruta_cache.read_text()) if ruta_cache.exists() else {}

    if len(sys.argv) == 3 and sys.argv[1] == "--fragmento":
        numero, total = (int(x) for x in sys.argv[2].split("/"))
        traducir_fragmento(catalogo, cache, numero - 1, total)
        return

    fragmentos = sorted(FRAGMENTOS.glob("pasos-*.json")) if FRAGMENTOS.exists() else []
    for f in fragmentos:
        cache.update(json.loads(f.read_text()))
    if fragmentos:
        print(f"Sumados {len(fragmentos)} fragmentos a la caché")

    if os.environ.get("TRADUCIR") == "1":
        pendientes = pasos_pendientes(catalogo, cache)
        if pendientes:
            traducir = cargar_traductor()
            for k, paso in pendientes.items():
                cache[k] = aplicar_glosario(traducir(paso))

    if cache:
        guardar_json(ruta_cache, cache)
    armar(catalogo, cache)


if __name__ == "__main__":
    main()
