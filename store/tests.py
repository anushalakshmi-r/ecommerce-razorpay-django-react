from decimal import Decimal
from unittest.mock import patch

import requests
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Order, OrderItem, Product


class CreateRazorpayOrderTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.product = Product.objects.create(
            name='Test product',
            description='A test item',
            price=Decimal('100.00'),
            image_url='https://example.com/product.jpg',
        )
        self.checkout_data = {
            'product_id': self.product.id,
            'customer_name': 'Customer Name',
            'customer_email': 'customer@example.com',
            'customer_phone': '+919876543210',
            'address_line1': '1 Test Street',
            'address_line2': 'Apartment 2',
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'postal_code': '400001',
            'country': 'India',
            'shipping_method': 'express',
        }

    @patch('store.views.client.order.create')
    def test_creates_order_with_shipping_details_and_total(self, create_order):
        create_order.return_value = {
            'id': 'order_test_1',
            'amount': 19900,
            'currency': 'INR',
        }

        response = self.client.post(
            '/api/create-razorpay-order/',
            self.checkout_data,
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['amount'], 19900)
        self.assertEqual(response.data['total_amount'], '199.00')
        self.assertEqual(response.data['shipping_amount'], '99.00')
        create_order.assert_called_once_with({
            'amount': 19900,
            'currency': 'INR',
            'payment_capture': '1',
        })

        order = Order.objects.get(razorpay_order_id='order_test_1')
        self.assertEqual(order.amount, Decimal('199.00'))
        self.assertEqual(order.shipping_amount, Decimal('99'))
        self.assertEqual(order.customer_name, 'Customer Name')
        self.assertEqual(order.customer_email, 'customer@example.com')
        self.assertEqual(order.address_line1, '1 Test Street')
        self.assertEqual(order.address_line2, 'Apartment 2')
        self.assertEqual(order.postal_code, '400001')
        self.assertEqual(order.shipping_method, 'express')

    @patch('store.views.client.order.create')
    def test_rejects_invalid_checkout_data_without_creating_payment_order(self, create_order):
        invalid_data = {
            **self.checkout_data,
            'customer_email': 'not-an-email',
            'shipping_method': 'overnight',
        }

        response = self.client.post(
            '/api/create-razorpay-order/',
            invalid_data,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('customer_email', response.data)
        self.assertIn('shipping_method', response.data)
        create_order.assert_not_called()
        self.assertEqual(Order.objects.count(), 0)

    @patch('store.views.client.order.create')
    def test_standard_shipping_has_no_extra_charge(self, create_order):
        create_order.return_value = {
            'id': 'order_test_2',
            'amount': 10000,
            'currency': 'INR',
        }
        checkout_data = {**self.checkout_data, 'shipping_method': 'standard'}

        response = self.client.post(
            '/api/create-razorpay-order/',
            checkout_data,
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['amount'], 10000)
        order = Order.objects.get(razorpay_order_id='order_test_2')
        self.assertEqual(order.shipping_amount, Decimal('0'))
        self.assertEqual(order.amount, Decimal('100.00'))

    @patch('store.views.client.order.create')
    def test_cart_checkout_charges_and_saves_all_products(self, create_order):
        second_product = Product.objects.create(
            name='Second test product',
            description='Another test item',
            price=Decimal('50.25'),
            image_url='https://example.com/second-product.jpg',
        )
        create_order.return_value = {
            'id': 'order_test_cart',
            'amount': 24925,
            'currency': 'INR',
        }
        checkout_data = {
            **self.checkout_data,
            'product_ids': [self.product.id, second_product.id],
        }
        checkout_data.pop('product_id')

        response = self.client.post(
            '/api/create-razorpay-order/',
            checkout_data,
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['product_amount'], '150.25')
        self.assertEqual(response.data['shipping_amount'], '99.00')
        self.assertEqual(response.data['total_amount'], '249.25')
        self.assertEqual(response.data['amount'], 24925)
        self.assertEqual(response.data['product_name'], 'Test product, Second test product')
        create_order.assert_called_once_with({
            'amount': 24925,
            'currency': 'INR',
            'payment_capture': '1',
        })

        order = Order.objects.get(razorpay_order_id='order_test_cart')
        items = list(order.items.order_by('product_id'))
        self.assertEqual(len(items), 2)
        self.assertEqual([item.product_id for item in items], [self.product.id, second_product.id])
        self.assertEqual(
            [item.unit_price for item in items],
            [Decimal('100.00'), Decimal('50.25')],
        )
        self.assertEqual(order.amount, Decimal('249.25'))

    @patch('store.views.client.order.create')
    def test_payment_provider_connection_error_is_reported(self, create_order):
        create_order.side_effect = requests.exceptions.ConnectionError('connection failed')

        response = self.client.post(
            '/api/create-razorpay-order/',
            self.checkout_data,
            format='json',
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn('error', response.data)
        self.assertEqual(Order.objects.count(), 0)

    @patch('store.views.client.utility.verify_payment_signature')
    def test_valid_payment_signature_confirms_order(self, verify_signature):
        order = Order.objects.create(
            product=self.product,
            razorpay_order_id='order_test_paid',
            amount=Decimal('100.00'),
        )

        response = self.client.post(
            '/api/verify-payment/',
            {
                'razorpay_order_id': 'order_test_paid',
                'razorpay_payment_id': 'pay_test_1',
                'razorpay_signature': 'valid-test-signature',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['order_id'], order.id)
        self.assertEqual(response.data['purchased_item'], self.product.name)
        order.refresh_from_db()
        self.assertEqual(order.status, 'PAID')
        self.assertEqual(order.razorpay_payment_id, 'pay_test_1')
        verify_signature.assert_called_once()
