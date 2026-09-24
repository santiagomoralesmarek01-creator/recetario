"""Traduce las medidas de TheMealDB ("2 tbsp chopped") al español ("2 cdas picado")."""
import re

# Frases completas (se aplican antes que las palabras sueltas)
FRASES = [
    (r"\bjuice and zest of one\b", "jugo y ralladura de 1"),
    (r"\bthe juice and zest of one\b", "jugo y ralladura de 1"),
    (r"\bjuice/zest of one\b", "jugo y ralladura de 1"),
    (r"\bzest and juice of\b", "ralladura y jugo de"),
    (r"\bgrated zest of\b", "ralladura de"),
    (r"\bzest of\b", "ralladura de"),
    (r"\bjuice of half\b", "jugo de medio"),
    (r"\bjuice of\b", "jugo de"),
    (r"\bjuice of 1, the other halved\b", "jugo de 1, el otro en mitades"),
    (r"\bas required\b", "cantidad necesaria"),
    (r"\bto taste\b", "a gusto"),
    (r"\bto serve\b", "para servir"),
    (r"\bto glaze\b", "para glasear"),
    (r"\bfor brushing\b", "para pintar"),
    (r"\bfor frying\b", "para freír"),
    (r"\bfor greasing\b", "para enmantecar"),
    (r"\bfor cooking\b", "para cocinar"),
    (r"\bgarnish with\b", "para decorar"),
    (r"\bsprigs of fresh\b", "ramitas frescas"),
    (r"\bpod of\b", "vaina"),
    (r"\bthumb sized\b", "trozo del tamaño de un pulgar,"),
    (r"\bmarble sized\b", "del tamaño de una bolita"),
    (r"\bsoaked overnight in water\b", "remojados toda la noche en agua"),
    (r"\bsoaked overnight\b", "remojados toda la noche"),
    (r"\bpatted dry\b", "secado"),
    (r"\bcut into chunks\b", "en trozos"),
    (r"\bcut chunks\b", "en trozos"),
    (r"\bcut into\b", "cortado en"),
    (r"\bcut in half lengthways\b", "cortado a lo largo por la mitad"),
    (r"\bcut thin wedges\b", "en gajos finos"),
    (r"\bcut thick slices\b", "en rodajas gruesas"),
    (r"\bthin cut\b", "en rodajas finas"),
    (r"\bcut cubes\b", "en cubos"),
    (r"\bstewing\b", "para guisar,"),
    (r"\bthick slices\b", "rodajas gruesas"),
    (r"\bthin slices\b", "rodajas finas"),
    (r"\bslices square\b", "fetas cuadradas"),
    (r"\bsliced thinly\b", "en rodajas finas"),
    (r"\bthinly sliced\b", "en rodajas finas"),
    (r"\bfinely sliced\b", "en rodajas finas"),
    (r"\bfinely chopped\b", "picado fino"),
    (r"\bvery finely grated\b", "rallado muy fino"),
    (r"\bfinely diced\b", "en cubitos"),
    (r"\bfreshly grated\b", "recién rallado"),
    (r"\bcoarsely grated\b", "rallado grueso"),
    (r"\broughly chopped\b", "picado grueso"),
    (r"\broughly crumbled\b", "desmenuzado grueso"),
    (r"\blightly toasted and then gently crushed\b", "apenas tostado y machacado"),
    (r"\bbashed to break shells\b", "golpeados para romper la cáscara"),
    (r"\bpounded to\b", "aplastado a"),
    (r"\bdeseeded\b", "sin semillas"),
    (r"\bsliced and seeded\b", "en rodajas y sin semillas"),
    (r"\bpeeled and chopped\b", "pelado y picado"),
    (r"\bpeeled and sliced\b", "pelado y en rodajas"),
    (r"\bpeeled and crushed\b", "pelado y machacado"),
    (r"\bpeeled crushed\b", "pelado y machacado"),
    (r"\bpeeled sliced\b", "pelado y en rodajas"),
    (r"\bpeeled raw\b", "pelados crudos"),
    (r"\breserve any fronds to garnish\b", "reservar las hojitas para decorar"),
    (r"\bblanched briefly in boiling water\b", "blanqueadas un momento en agua hirviendo"),
    (r"\bdry-cured\b", "curada"),
    (r"\bneutral frying\b", "de aceite neutro para freír"),
    (r"\bdissolved in\b", "disuelta en"),
    (r"\bwarm milk\b", "leche tibia"),
    (r"\bchopped with juice\b", "picado con su jugo"),
    (r"\bmeaty shanks\b", "garrones carnosos"),
    (r"\bfresh kaffir leaves\b", "hojas frescas de lima kaffir"),
    (r"\bpalm or soft light\b", "de palma o rubia"),
    (r"\bboneless skin\b", "sin hueso, con piel"),
    (r"\bfree-range\b", "de campo"),
    (r"\bsmall pack\b", "paquete chico"),
    (r"\blarge handful\b", "puñado grande"),
    (r"\blarge piece\b", "trozo grande"),
    (r"\bsmall bunch\b", "atado chico"),
    (r"\bfresh sprig\b", "ramita fresca"),
    (r"\bpackage thin\b", "paquete, finos"),
]

PALABRAS = {
    "tablespoons": "cdas", "tablespoon": "cda", "tbsp": "cda", "tbs": "cda", "tblsp": "cda", "tbls": "cda",
    "teaspoons": "cdtas", "teaspoon": "cdta", "tsp": "cdta",
    "cups": "tazas", "cup": "taza", "pint": "pinta", "quarts": "cuartos de galón", "quart": "cuarto de galón", "qt": "cuartos de galón",
    "pounds": "libras", "pound": "libra", "lbs": "lb", "lb": "lb", "ounces": "onzas", "ounce": "onza", "oz": "oz", "fl": "fl",
    "grams": "g", "milliliters": "ml", "litres": "litros", "litre": "litro",
    "cloves": "dientes", "clove": "diente", "bunch": "atado", "bulb": "cabeza", "head": "cabeza", "heads": "cabezas",
    "handful": "puñado", "handfull": "puñado", "handfuls": "puñados", "handfulls": "puñados",
    "knob": "nuez", "knobs": "nueces", "pinch": "pizca", "pinches": "pizcas", "dash": "chorrito", "drop": "gota", "drops": "gotas",
    "splash": "chorrito", "drizzle": "chorrito", "shot": "medida", "shots": "medidas", "scoop": "bocha",
    "can": "lata", "cans": "latas", "tin": "lata", "tins": "latas", "tinned": "en lata", "jar": "frasco", "bottle": "botella",
    "packet": "paquete", "pack": "paquete", "package": "paquete", "bag": "bolsa", "pot": "pote", "tub": "pote", "tubs": "potes",
    "sprig": "ramita", "sprigs": "ramitas", "stalk": "tallo", "stalks": "tallos", "stick": "barra", "sticks": "barras",
    "leaf": "hoja", "leaves": "hojas", "slice": "feta", "slices": "fetas", "strips": "tiras", "pieces": "trozos", "piece": "trozo",
    "fillets": "filetes", "florets": "ramitos", "pods": "vainas", "rashers": "fetas", "tail": "cola", "part": "parte", "parts": "partes",
    "inch": "pulgada", "yolk": "yema", "yolkes": "yemas", "whole": "entero", "half": "medio", "halved": "en mitades", "quartered": "en cuartos",
    "large": "grande", "medium": "mediano", "small": "chico", "thin": "fino", "thick": "grueso", "mild": "suave", "red": "rojo", "white": "blanco",
    "chopped": "picado", "diced": "en cubitos", "sliced": "en rodajas", "minced": "picado", "grated": "rallado", "shredded": "en tiras",
    "crushed": "machacado", "beaten": "batido", "melted": "derretida", "mashed": "pisado", "cubed": "en cubos", "ground": "molido",
    "dried": "seco", "fresh": "fresco", "raw": "crudo", "boiling": "hirviendo", "boiled": "hervido", "steamed": "al vapor",
    "hot": "caliente", "trimmed": "limpio", "rinsed": "enjuagado", "peeled": "pelado", "torn": "en trozos", "shavings": "en lascas",
    "shaved": "en lascas", "fine": "fino", "skinned": "sin piel", "skinnless": "sin piel", "boneless": "sin hueso", "waxy": "de pulpa firme",
    "new": "nuevas", "seperated": "separados", "separated": "separados", "tips": "puntas", "milk": "leche", "frying": "para freír",
    "garnish": "para decorar", "dusting": "para espolvorear", "grating": "rallado", "sprinkling": "para espolvorear",
    "sprinking": "para espolvorear", "spinkling": "para espolvorear", "top": "por encima", "topping": "para cubrir",
    "fry": "para freír", "juice": "jugo", "zest": "ralladura", "ancho": "ancho", "and": "y", "or": "o", "into": "en", "of": "de",
    "with": "con", "to": "a", "in": "en", "the": "", "one": "uno", "garlic": "de ajo", "cubes": "cubos", "x": "x", "thickness": "de espesor", "pounded": "aplastado",
    "wedges": "gajos", "cut": "cortado", "serve": "servir", "l": "l", "kg": "kg", "g": "g", "ml": "ml", "cm": "cm", "3rd": "un tercio",
    "piece": "trozo",
}

# Casos puntuales que las reglas no resuelven bien
EXACTAS = {
    "1 – 14-ounce can": "1 lata de 14 onzas",
    "2 juice": "Jugo de 2",
    "2 juice of 1, the other halved": "2 (jugo de 1 y el otro en mitades)",
    "3rd": "1/3",
    "225g new": "225 g (papines)",
    "½ tablespoon thick": "½ cda (espesa)",
    "3 rashers (100g) chopped dry-cured": "3 fetas (100 g), curadas y picadas",
    "garnish chopped": "Picado, para decorar",
    "1 seperated": "1 (yema y clara separadas)",
    "1 inch": "Trozo de 1 pulgada (2,5 cm)",
    "1 package thin": "1 paquete (finos)",
    "1 red": "1 rojo",
    "white": "Clara",
    "1 part": "1 parte",
    "8-ounce sliced": "8 onzas, en rodajas",
    "1.5 tablespoons minced garlic": "1,5 cdas de ajo picado",
    "5 chopped cloves": "5 dientes picados",
    "6 medium cloves sliced": "6 dientes medianos en rodajas",
    "2 small stalks": "2 tallos chicos",
    "1 thin piece": "1 trozo fino",
}

ADJETIVOS_PLURAL = {"grande": "grandes", "chico": "chicos", "mediano": "medianos", "picado": "picados", "batido": "batidos",
                    "entero": "enteros", "seco": "secos", "pisado": "pisados", "machacado": "machacados", "rallado": "rallados",
                    "aplastado": "aplastados", "cortado": "cortados", "pelado": "pelados", "hervido": "hervidos"}

SINGULARES = {"cdas": "cda", "cdtas": "cdta", "tazas": "taza", "dientes": "diente", "latas": "lata", "hojas": "hoja",
              "fetas": "feta", "libras": "libra", "onzas": "onza"}

PLURALES = {"cda": "cdas", "cdta": "cdtas", "taza": "tazas", "diente": "dientes", "lata": "latas", "hoja": "hojas", "ramita": "ramitas",
            "feta": "fetas", "puñado": "puñados", "barra": "barras", "pizca": "pizcas", "tallo": "tallos", "cabeza": "cabezas",
            "libra": "libras", "onza": "onzas"}


def traducir_medida(texto):
    t = (texto or "").strip()
    if not t:
        return ""
    t = re.sub(r"\s+", " ", t)
    if t.lower() in EXACTAS:
        return EXACTAS[t.lower()]
    # "cut into ½-inch pieces", "3cm cubes", "1.5cm-thick slices"
    t = re.sub(r"(?:into )?([\d½¼¾/.,]+)\s*-?\s*(inch|cm)[- ]?(thick )?(cubes|pieces|slices)",
               lambda m: f"en {dict(cubes='cubos', pieces='trozos', slices='rodajas')[m.group(4)]}"
                         f"{' gruesas' if m.group(3) else ''} de {m.group(1)} {'pulgada' if m.group(2) == 'inch' else 'cm'}",
               t, flags=re.I)
    t = re.sub(r"(\d+(?:[.,]\d+)?)\s*cm piece", r"trozo de \1 cm", t, flags=re.I)
    t = re.sub(r"(\d)cm\b", r"\1 cm", t)
    t = re.sub(r"(\d+)-ounce", r"\1 onzas", t)
    t = re.sub(r"(\d)(tbsp|tsp|kg|g|ml|l|lb)\b", r"\1 \2", t, flags=re.I)
    t = re.sub(r"(\d) and (\d/\d)", r"\1 \2", t)
    t = re.sub(r"\b(\d+)-(\d/\d|½|⅓)", r"\1 \2", t)
    bajo = t.lower()
    for patron, reemplazo in FRASES:
        bajo = re.sub(patron, reemplazo, bajo)

    def palabra(m):
        w = m.group(0)
        return PALABRAS.get(w, w)

    bajo = re.sub(r"[a-záéíóúñü]+", palabra, bajo)
    bajo = re.sub(r"(\d+(?:\s?(?:\d/\d|½|¼|¾|⅓))|\d+-\d+|\d+(?:[.,]\d+)?|\d/\d|½|¼|¾|⅓)\s*(cda|cdta|taza|diente|lata|hoja|ramita|feta|puñado|barra|pizca|tallo|cabeza|libra|onza)\b",
                  lambda m: f"{m.group(1)} {PLURALES[m.group(2)] if _mayor_que_uno(m.group(1)) else m.group(2)}", bajo)
    bajo = re.sub(r"^(1|½|¼|¾|⅓|\d/\d) (cdas|cdtas|tazas|dientes|latas|hojas|fetas|libras|onzas)\b",
                  lambda m: f"{m.group(1)} {SINGULARES[m.group(2)]}", bajo)
    # "3 dientes picado" -> "3 dientes picados"
    bajo = re.sub(r"^(\S+ (?:dientes)) ([a-záéíóúñ]+)\b",
                  lambda m: f"{m.group(1)} {ADJETIVOS_PLURAL.get(m.group(2), m.group(2))}" if m.group(1).split()[0] != "1" else m.group(0), bajo)
    # "2 grande" -> "2 grandes" (sólo si el número es mayor que uno)
    bajo = re.sub(r"^(\S+) ([a-záéíóúñ]+)\b", lambda m: f"{m.group(1)} {ADJETIVOS_PLURAL.get(m.group(2), m.group(2)) if _mayor_que_uno(m.group(1)) else m.group(2)}", bajo)
    bajo = re.sub(r"(\d)\.(\d)", r"\1,\2", bajo)
    bajo = re.sub(r"\s+", " ", bajo).strip(" ,;")
    return bajo[:1].upper() + bajo[1:] if bajo and not bajo[0].isdigit() else bajo


def _mayor_que_uno(n):
    if re.fullmatch(r"\d+\s?(\d/\d|½|¼|¾|⅓)", n) or re.fullmatch(r"\d+-\d+", n):
        return True
    if n in ("½", "¼", "¾", "⅓") or "/" in n:
        return False
    try:
        return float(n.replace(",", ".")) > 1
    except ValueError:
        return False
