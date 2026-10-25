# store/seed_data.py
from store.models import Product

def populate():
    print("Clearing old products...")
    Product.objects.all().delete()

    print("Adding Add-on Products...")
    tray = Product.objects.create(
        name="Drainage Drip Tray",
        description="Water-resistant matte black drip tray tailored for geometric planters.",
        price=149.00,
        image_url="https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&q=80"
    )

    garden_tools = Product.objects.create(
        name="Miniature Gardening Tool Set",
        description="3-piece compact stainless steel spade, rake, and shovel set for desk plants.",
        price=199.00,
        image_url="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=500&q=80"
    )

    clips = Product.objects.create(
        name="Magnetic Cable Clips (3-Pack)",
        description="Organize your charging cords neatly along your headphone stand or desk edge.",
        price=199.00,
        image_url="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&q=80"
    )

    rgb_ring = Product.objects.create(
        name="RGB Base Light Ring",
        description="USB-powered circular ambient lighting disc with 7 color modes.",
        price=349.00,
        image_url="https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&q=80"
    )

    acrylic_case = Product.objects.create(
        name="Dust-proof Acrylic Display Case",
        description="Ultra-clear 3mm acrylic showcase box with easy magnetic latch.",
        price=399.00,
        image_url="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&q=80"
    )

    led_spotlight = Product.objects.create(
        name="Warm LED Spotlight Base",
        description="Solid wooden circular pedestal with upward-facing warm spotlight.",
        price=249.00,
        image_url="https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&q=80"
    )

    print("Adding Main Products and Linking Add-ons...")
    
    # 1. Desk Planter
    planter = Product.objects.create(
        name="Cyberpunk Desk Planter (3D Printed)",
        description="Futuristic low-poly indoor succulent planter printed in eco-friendly matte PLA.",
        price=599.00,
        image_url="https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=500&q=80"
    )
    planter.related_addons.add(tray, garden_tools)

    # 2. Headphone Stand
    headphone_stand = Product.objects.create(
        name="Mechanical Headphone Stand",
        description="Ergonomic desktop headset mount engineered with weighted anti-slip stability.",
        price=899.00,
        image_url="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80"
    )
    headphone_stand.related_addons.add(clips, rgb_ring)

    # 3. Arc Reactor Prop
    arc_reactor = Product.objects.create(
        name="Iron Man Arc Reactor Desk Prop",
        description="High-detail 1:1 scale metallic finish showpiece with internal diffusion ring.",
        price=1299.00,
        image_url="https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500&q=80"
    )
    arc_reactor.related_addons.add(acrylic_case, led_spotlight)

    print("All sample products and add-ons successfully populated!")