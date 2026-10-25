from rest_framework import serializers
from .models import Product, Order, SHIPPING_METHOD_CHOICES

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'image_url']

class OrderSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    class Meta:
        model = Order
        fields = '__all__'


class CheckoutRequestSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1, required=False)
    product_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        max_length=50,
        required=False,
    )
    customer_name = serializers.CharField(max_length=200)
    customer_email = serializers.EmailField()
    customer_phone = serializers.RegexField(
        regex=r'^\+?[0-9\s()-]{7,20}$',
        max_length=20,
    )
    address_line1 = serializers.CharField(max_length=255)
    address_line2 = serializers.CharField(max_length=255, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100)
    state = serializers.CharField(max_length=100)
    postal_code = serializers.RegexField(regex=r'^[A-Za-z0-9 -]{3,12}$', max_length=12)
    country = serializers.CharField(max_length=100)
    shipping_method = serializers.ChoiceField(choices=SHIPPING_METHOD_CHOICES)

    def validate(self, attrs):
        product_ids = attrs.get('product_ids')
        if product_ids is None and attrs.get('product_id') is not None:
            product_ids = [attrs['product_id']]
        elif product_ids is None:
            raise serializers.ValidationError({'product_ids': 'At least one product is required.'})

        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError({'product_ids': 'Duplicate products are not allowed.'})

        attrs['product_ids'] = product_ids
        return attrs