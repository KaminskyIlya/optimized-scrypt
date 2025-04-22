Файл scrypt4_test.htm демонстрирует корректность работы библиотеки после рефакторинга.

После запуска вы должны увидеть контрольные значения для пароля password123 и соли 'BEB25379 D1A8581E B5A72767 3A2441EE':

**ожидаемый вывод**
```
Успех
97efe4f6d2b77b18ede4102d1cb43f03b958bf90a9a63e15826ddab293092aa1
97efe4f6d2b77b18ede4102d1cb43f03b958bf90a9a63e15826ddab293092aa1
Время генерации: 321мс
```

**пример использования библиотеки**
```
	P = ENCODER.encode('password123'),
	hex = (s) => BigInt('0x' + s.replace(/\s/g, '')),
	salt = hex('BEB25379 D1A8581E B5A72767 3A2441EE').toUint8Array(),
	
	start = new Date(),	
	x = scrypt4(P, salt, 16384, 8, 1, 256/8),
```
