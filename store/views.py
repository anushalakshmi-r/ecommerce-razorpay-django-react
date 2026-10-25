from decimal import Decimal

import razorpay
import requests
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Product, Order, OrderItem, SHIPPING_RATES
from .serializers import CheckoutRequestSerializer, ProductSerializer

client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


class ProductListView(APIView):
    def get(self, request):
        products = Product.objects.all()
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)


class CreateRazorpayOrderView(APIView):
    def post(self, request):
        checkout_serializer = CheckoutRequestSerializer(data=request.data)
        if not checkout_serializer.is_valid():
            return Response(checkout_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        checkout_data = checkout_serializer.validated_data
        products_by_id = Product.objects.in_bulk(checkout_data['product_ids'])
        missing_product_ids = set(checkout_data['product_ids']) - set(products_by_id)
        if missing_product_ids:
            return Response(
                {'error': f"Product(s) not found: {', '.join(map(str, sorted(missing_product_ids)))}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        products = [products_by_id[product_id] for product_id in checkout_data['product_ids']]
        product = products[0]
        shipping_amount = Decimal(SHIPPING_RATES[checkout_data['shipping_method']])
        product_amount = sum((item.price for item in products), Decimal('0.00'))
        total_amount = product_amount + shipping_amount

        amount_in_paise = int(total_amount * 100)
        try:
            razorpay_order = client.order.create({
                'amount': amount_in_paise,
                'currency': 'INR',
                'payment_capture': '1',
            })
        except (
            razorpay.errors.BadRequestError,
            razorpay.errors.GatewayError,
            razorpay.errors.ServerError,
            requests.exceptions.RequestException,
        ) as error:
            return Response(
                {'error': f'Unable to create payment order: {error}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        order = Order.objects.create(
            product=product,
            razorpay_order_id=razorpay_order['id'],
            amount=total_amount,
            shipping_amount=shipping_amount,
            customer_name=checkout_data['customer_name'],
            customer_email=checkout_data['customer_email'],
            customer_phone=checkout_data['customer_phone'],
            address_line1=checkout_data['address_line1'],
            address_line2=checkout_data.get('address_line2', ''),
            city=checkout_data['city'],
            state=checkout_data['state'],
            postal_code=checkout_data['postal_code'],
            country=checkout_data['country'],
            shipping_method=checkout_data['shipping_method'],
            status='PENDING',
        )

        OrderItem.objects.bulk_create([
            OrderItem(order=order, product=item, unit_price=item.price)
            for item in products
        ])

        return Response({
            'razorpay_order_id': razorpay_order['id'],
            'amount': razorpay_order['amount'],
            'currency': razorpay_order['currency'],
            'razorpay_key': settings.RAZORPAY_KEY_ID,
            'product_name': ', '.join(item.name for item in products),
            'product_description': ', '.join(item.description for item in products),
            'product_amount': f'{product_amount:.2f}',
            'shipping_amount': f'{shipping_amount:.2f}',
            'total_amount': f'{total_amount:.2f}',
        })


# 3. பணம் கட்டிய பிறகு Signature சரிபார்த்து Upsell பரிந்துரைக்கும் API
class VerifyPaymentView(APIView):
    def post(self, request):
        data = request.data
        razorpay_order_id = data.get('razorpay_order_id')
        razorpay_payment_id = data.get('razorpay_payment_id')
        razorpay_signature = data.get('razorpay_signature')

        # Signature சரிபார்த்தல் (Security Check)
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }

        try:
            # சிக்னேச்சர் தவறாக இருந்தால் இந்த மெத்தட் SignatureVerificationError கொடுக்கும்
            client.utility.verify_payment_signature(params_dict)
            
            # ஆர்டரை அப்டேட் செய்தல்
            order = Order.objects.get(razorpay_order_id=razorpay_order_id)
            order.razorpay_payment_id = razorpay_payment_id
            order.razorpay_signature = razorpay_signature
            order.status = 'PAID'
            order.save()

            # இந்த பொருளுக்கான Add-on பரிந்துரைகளை அனுப்புதல்
            purchased_products = [item.product for item in order.items.select_related('product')]
            if not purchased_products:
                purchased_products = [order.product]
            addons = Product.objects.filter(
                related_addons__in=purchased_products,
            ).distinct()
            addon_serializer = ProductSerializer(addons, many=True)
            purchased_items = [item.name for item in purchased_products]

            return Response({
                'status': 'success',
                'message': 'Payment verified successfully!',
                'order_id': order.id,
                'purchased_item': ', '.join(purchased_items),
                'purchased_items': purchased_items,
                'recommendations': addon_serializer.data
            })

        except razorpay.errors.SignatureVerificationError:
            return Response({'status': 'failed', 'message': 'Signature verification failed'}, status=status.HTTP_400_BAD_REQUEST)
        except Order.DoesNotExist:
            return Response({'status': 'failed', 'message': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)


from django.contrib.auth import get_user_model
from django.http import JsonResponse
from .models import Product

def setup_project(request):
    try:
        # 1. Admin user உருவாக்குதல் அல்லது பாஸ்வேர்ட் மாற்றுதல்
        User = get_user_model()
        user, created = User.objects.get_or_create(username='admin')
        user.set_password('Admin@12345')
        user.is_staff = True
        user.is_superuser = True
        user.save()
        user_status = "Admin created" if created else "Admin password updated"

        # 2. Products டேட்டா ஏற்றுதல்
        from store.seed_data import populate
        populate()

        return JsonResponse({
            "status": "success",
            "admin_status": user_status,
            "username": "admin",
            "password": "Admin@12345",
            "products_count": Product.objects.count()
        })
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "error_message": str(e)
        }, status=200)