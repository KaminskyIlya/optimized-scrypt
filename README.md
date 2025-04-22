# optimized-scrypt
The  javascript implementation of the Scrypt libruary (with optimized code, up to 25% perfomance by time, see benchmarks)

adaptive cryptographic key generation function based on a password, the function is designed in such a way as to complicate a brute force attack using FPGAs. It requires a significant amount of random access memory to calculate it. 
In short, the function is designed to make it more difficult to directly select passwords based on a known hash (brute force) by slowing down hash calculations. The function is also used in the Litecoin cryptocurrency as proof of work done (the function is used by miners)

This project is the implementation of a function in javascrypt and its subsequent optimization using standard language tools
to prove (Proof-Of-Concept) that the function is not as resistant to optimizations as its creators claim.
the author of the repository claims that the greatest performance of the function can be obtained on an FPGA of its own production
. **How to achieve a theoretical speed of 3 Hz/hash** is generally written on https://habr.com /
the author claims that he managed to bring the speed of this function to 10 MHz
on a specialized FPGA chip.

##What optimizations have been performed?:
1. Slightly rewritten SHA2
2. Rearranging commands inside the salsa20_8 loop to use the superscalarity of the Cpu In Java, it had an effect of 12%. In Js, it's possible too. We need more measurements.
3. The PBKDF2 function has been optimized.The loop is not merging arrays, but overwriting them into a buffer. Constant calculations have also been removed from the loop. There are measurements in a similar Java code - it gave an acceleration there.  In addition, PBKDF2 code can be executed in 32 independent streams.  I did it in Java in 4 threads. I got an acceleration of 4 times in this section.
4. Optimized the blockmix_salsa 8 function, avoiding unnecessary copying of 512 bytes and unnecessary memory allocation in the loop. Considering that the function will be called N times, this is a good optimization.
   
  **these changes increased the overall performance of the function by an average of 25%**
  
##reference (reference) hashes for different passwords
  ```
111111Qq:51dd01f633dcabccda8190be3c7bc9973918c6f59668e077522f8ef8eef561af
password123:97efe4f6d2b77b18ede4102d1cb43f03b958bf90a9a63e15826ddab293092aa1
test:558597b557f9883a3420e754a4c4fc3aead9edce2b511c9aa194e0372ee0198c
```

#Use:
```html
<script src="scrypt4.js"></script>
```
```javascript
let
	ENCODER = new TextEncoder(),
	pas = 'your secret password',	
	P = ENCODER.encode(pas),
	hex = (s) => BigInt('0x' + s.replace(/\s/g, '')),
	salt = hex('BEB25379 D1A8581E B5A72767 3A2441EE').toUint8Array(),
		
	hash = scrypt4(P, salt, 16384, 8, 1, 256/8),// 32 bytes Uint8Array returns
```
#Benchmarks:

```
scrypt_benchmarks.htm: The calculation is completed (the script is the original version of the developer)
scrypt_benchmarks.htm: x = 151,239,228,246,210,183,123,24,237,228,16,45,28,180,63,3,185,88,191,144,169,166,62,21,130,109,218,178,147,9,42,161
scrypt_benchmarks.htm: Time: 0.317sec
scrypt_benchmarks.htm: The calculation is completed (script 4 this optimized version)
scrypt_benchmarks.htm: x = 151,239,228,246,210,183,123,24,237,228,16,45,28,180,63,3,185,88,191,144,169,166,62,21,130,109,218,178,147,9,42,161
scrypt_benchmarks.htm: Time: 0.242sec
```
