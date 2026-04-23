import unittest

from calculator import add, calculate, divide, multiply, subtract


class CalculatorTests(unittest.TestCase):
    def test_add(self):
        self.assertEqual(add(2, 3), 5)
        self.assertEqual(add(-1, 1), 0)

    def test_subtract(self):
        self.assertEqual(subtract(10, 4), 6)
        self.assertEqual(subtract(0, 5), -5)

    def test_multiply(self):
        self.assertEqual(multiply(3, 4), 12)
        self.assertEqual(multiply(-2, 5), -10)

    def test_divide(self):
        self.assertEqual(divide(10, 2), 5)
        self.assertAlmostEqual(divide(1, 3), 0.3333333, places=6)

    def test_divide_by_zero(self):
        with self.assertRaises(ZeroDivisionError):
            divide(1, 0)

    def test_calculate_dispatch(self):
        self.assertEqual(calculate(2, "+", 3), 5)
        self.assertEqual(calculate(5, "-", 2), 3)
        self.assertEqual(calculate(4, "*", 2), 8)
        self.assertEqual(calculate(9, "/", 3), 3)

    def test_calculate_unknown_operator(self):
        with self.assertRaises(ValueError):
            calculate(1, "%", 2)


if __name__ == "__main__":
    unittest.main()
