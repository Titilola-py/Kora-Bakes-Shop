from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Product:
    id: str
    name: str
    description: str
    category: str
    price_kobo: int
    unit: str
    image_url: str
    badge: str


PRODUCTS = (
    Product(
        "croissant-box", "Butter Croissant Box", "Six flaky, all-butter pastries, baked fresh each morning.",
        "Pastries", 650_000, "box of 6",
        "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=82", "Bestseller",
    ),
    Product(
        "banana-bread", "Banana Bread", "A tender, golden loaf made with very ripe bananas.",
        "Loaves", 700_000, "one loaf",
        # Pexels: David Payne, photo 6803031. Free for commercial use under the Pexels license.
        "https://images.pexels.com/photos/6803031/pexels-photo-6803031.jpeg?auto=compress&cs=tinysrgb&w=900", "House favourite",
    ),
    Product(
        "coconut-chin-chin", "Danish Cookies", "Crisp, buttery Danish-style cookies.",
        "Small bites", 450_000, "300 g jar",
        # Pexels: A Vasan, photo 14288447. Free for commercial use under the Pexels license.
        "https://images.pexels.com/photos/14288447/pexels-photo-14288447.jpeg?auto=compress&cs=tinysrgb&w=900", "Made for sharing",
    ),
    Product(
        "cupcakes-box-6", "Cupcakes, box of 6", "A box of cupcakes.",
        "Pastries", 250_000, "box of 6",
        "https://images.unsplash.com/photo-1603532648955-039310d9ed75?auto=format&fit=crop&w=900&q=82", "",
    ),
    Product(
        "puff-puff-box", "Cupcakes, box of 12", "A box of cupcakes.",
        "Pastries", 500_000, "box of 12",
        "https://images.unsplash.com/photo-1603532648955-039310d9ed75?auto=format&fit=crop&w=900&q=82", "",
    ),
    Product(
        "cinnamon-rolls", "Cinnamon Rolls", "Six pillowy rolls finished with a light vanilla glaze.",
        "Pastries", 850_000, "box of 6",
        "https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=900&q=82", "Weekend treat",
    ),
    Product(
        # Keep the existing product ID and price so stored cart/order references remain valid.
        "sourdough-loaf", "Whole Wheat Loaf", "A freshly baked whole wheat loaf.",
        "Loaves", 900_000, "one loaf",
        # Pexels: Jonas Kakaroto, photo 10109372. Free for commercial use under the Pexels license.
        "https://images.pexels.com/photos/10109372/pexels-photo-10109372.jpeg?auto=compress&cs=tinysrgb&w=900", "",
    ),
)

PRODUCT_BY_ID = {product.id: product for product in PRODUCTS}


def public_product(product: Product) -> dict[str, object]:
    return asdict(product)
