"""Simple calculator module."""


def add(a: float, b: float) -> float:
    return a + b


def subtract(a: float, b: float) -> float:
    return a - b


def multiply(a: float, b: float) -> float:
    return a * b


def divide(a: float, b: float) -> float:
    if b == 0:
        raise ZeroDivisionError("division by zero")
    return a / b


OPS = {
    "+": add,
    "-": subtract,
    "*": multiply,
    "/": divide,
}


def calculate(a: float, op: str, b: float) -> float:
    if op not in OPS:
        raise ValueError(f"unknown operator: {op}")
    return OPS[op](a, b)


def main() -> None:
    import sys

    if len(sys.argv) != 4:
        print("usage: calculator.py <a> <op> <b>", file=sys.stderr)
        sys.exit(2)
    a, op, b = sys.argv[1], sys.argv[2], sys.argv[3]
    print(calculate(float(a), op, float(b)))


if __name__ == "__main__":
    main()
