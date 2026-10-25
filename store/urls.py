from django.urls import path
from .views import ProductListView, CreateRazorpayOrderView, VerifyPaymentView, setup_project

urlpatterns = [
    path('products/', ProductListView.as_view(), name='product-list'),
    path('create-razorpay-order/', CreateRazorpayOrderView.as_view(), name='create-razorpay-order'),
    path('verify-payment/', VerifyPaymentView.as_view(), name='verify-payment'),
    path('setup-project/', setup_project, name='setup-project'), # <-- Intha line-ai sethukonga
]