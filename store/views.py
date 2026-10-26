from decimal import Decimal
import razorpay
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Product, Order
from .serializers import ProductSerializer
from store.seed_data import populate


client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


class ProductListView(APIView):
    def get(self, request):
        # If the database was wiped after a server restart, auto-seed it immediately
        if Product.objects.count() == 0:
            try:
                populate()
            except Exception as e:
                print(f"Auto-seed error: {e}")

        products = Product.objects.all()
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)


class CreateRazorpayOrderView(APIView):
    def post(self, request):
        product_id = request.data.get('product_id')

        # Fallback to the first available product if ID is invalid or missing
        product = Product.objects.filter(id=product_id).first()
        if not product:
            product = Product.objects.first()

        if not product:
            return Response({'error': 'No products available in database.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            amount_in_paise = int(float(product.price) * 100)

            key_id = str(settings.RAZORPAY_KEY_ID).strip()
            key_secret = str(settings.RAZORPAY_KEY_SECRET).strip()

            client = razorpay.Client(auth=(key_id, key_secret))

            razorpay_order = client.order.create({
                'amount': amount_in_paise,
                'currency': 'INR',
                'payment_capture': 1
            })

            Order.objects.create(
                product=product,
                razorpay_order_id=razorpay_order['id'],
                amount=product.price,
                status='PENDING'
            )

            return Response({
                'razorpay_order_id': razorpay_order['id'],
                'amount': razorpay_order['amount'],
                'currency': razorpay_order['currency'],
                'razorpay_key': key_id,
                'product_name': product.name,
                'product_description': product.description
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        
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