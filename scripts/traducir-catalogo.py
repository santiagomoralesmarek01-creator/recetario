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


def main():
    catalogo = json.loads((FUENTE / "mealdb-en.json").read_text())
    nombres = json.loads((FUENTE / "nombres-es.json").read_text())
    ingredientes = json.loads((FUENTE / "ingredientes-es.json").read_text())
    ruta_cache = FUENTE / "pasos-es.json"
    cache = json.loads(ruta_cache.read_text()) if ruta_cache.exists() else {}

    pendientes = {}
    for receta in catalogo["recetas"]:
        for paso in separar_pasos(receta["instrucciones"]):
            if clave(paso) not in cache:
                pendientes[clave(paso)] = paso

    print(f"Pasos a traducir: {len(pendientes)} (en caché: {len(cache)})", flush=True)
    if pendientes and os.environ.get("SIN_TRADUCTOR"):
        # Sólo para probar el armado: deja los pasos en inglés y no toca la caché.
        cache = {**cache, **pendientes}
    elif pendientes:
        traducir = cargar_traductor()
        for n, (k, paso) in enumerate(pendientes.items(), 1):
            cache[k] = aplicar_glosario(traducir(paso))
            if n % 200 == 0:
                print(f"  {n}/{len(pendientes)}", flush=True)
                ruta_cache.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True))
        ruta_cache.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True))

    SALIDA.mkdir(parents=True, exist_ok=True)
    for viejo in SALIDA.glob("*.json"):
        viejo.unlink()

    indice = []
    for receta in catalogo["recetas"]:
        rid = receta["id"]
        ings = [[ingredientes[n.lower()], traducir_medida(m), n] for n, m in receta["ingredientes"]]
        detalle = {
            "id": rid,
            "nombre": nombres[rid],
            "original": receta["nombre"],
            "categoria": receta["categoria"],
            "origen": ORIGENES.get(receta["origen"], receta["origen"]),
            "imagen": receta["imagen"],
            "video": receta["video"],
            "enlace": receta["enlace"],
            "etiquetas": sorted({ETIQUETAS[t.lower()] for t in receta["etiquetas"] if t.lower() in ETIQUETAS}),
            "ingredientes": ings,
            "pasos": [cache[clave(p)] for p in separar_pasos(receta["instrucciones"])],
        }
        (SALIDA / f"{rid}.json").write_text(json.dumps(detalle, ensure_ascii=False, separators=(",", ":")))
        indice.append([rid, nombres[rid], receta["categoria"], detalle["origen"], receta["imagen"],
                       "|".join(i[0] for i in ings)])

    categorias = [{"nombre": c["nombre"], "imagen": c["imagen"]} for c in catalogo["categorias"]]
    (SALIDA / "indice.json").write_text(json.dumps(
        {"campos": ["id", "nombre", "categoria", "origen", "imagen", "ingredientes"],
         "categorias": categorias, "recetas": indice},
        ensure_ascii=False, separators=(",", ":")))
    print(f"Listo: {len(indice)} recetas en {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
