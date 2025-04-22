/**
	ВНИМАНИЕ: это предварительная оптимизированная версия.
	Тестировалась (и оптимизированна) для параметров N=16384, p=1, r=8

	Какие оптимизации были выполнены:
	1. Слегка переписана SHA2
	2. Перегруппировка команд внутри цикла salsa20_8, для задействования суперскалярности Cpu
	   На Java дала эффект на 12%. На Js - возможно тоже. Нужно больше замеров.
	3. Оптимизирована функция PBKDF2.
	   В цикле идет не слияние массивов, а перезапись в буфер.
	   Также вынесены константные вычисления из цикла.
	   Есть замеры в аналогичном коде Java - там это дало ускорение.
	   Кроме того, код PBKDF2 может быть выполнен в 32 независимых потока.
	   Я делал на Java в 4 потока. Получил ускорение в 4 раза на этом участке.
	4. Подвергнул оптимизации функцию blockmix_salsa8, избежав
	   лишнего копирования 512 байт. С учетом, того что функция будет вызвана N раз,
	   то это хорошая оптимизация.
	   
	 ВАЖНО: убрал функционал ассинхронного выполнения функции, т.к. код не выполняется долго (248мсек)
*/
(function(root) {
    const MAX_VALUE = 0x7fffffff;


	// Я заменил "магические" цифры в SHA256, на алгоритм их вычисления. Так правильно.
	// Чтобы было понимание, откуда они такие взялись.
	
	// Initialization and round constants tables
	const I = []; // init vector здесь будут дробные части квадратных корней первых 8 простых чисел
	const K = []; // cipher key здесь будут дробные части кубических корней первых 64 простых чисел

	// Compute constants
	(function () {
		function isPrime(n) {
			var sqrtN = Math.sqrt(n);
			for (var factor = 2; factor <= sqrtN; factor++) {
				if (!(n % factor)) {
					return false;
				}
			}

			return true;
		}

		function getFractionalBits(n) {
			return ((n - (n | 0)) * 0x100000000) | 0;
		}

		var n = 2;
		var nPrime = 0;
		while (nPrime < 64) {
			if (isPrime(n)) {
				if (nPrime < 8) {
					I[nPrime] = getFractionalBits(Math.pow(n, 1 / 2));
				}
				K[nPrime] = getFractionalBits(Math.pow(n, 1 / 3));

				nPrime++;
			}

			n++;
		}
	}());


    
	function SHA256(m) 
	{
		// переменные h0..h7 - это текущее и выходное состояние хеш-функции
        let h0 = I[0], h1 = I[1], h2 = I[2], h3 = I[3];
        let h4 = I[4], h5 = I[5], h6 = I[6], h7 = I[7];
        const w = new Uint32Array(64);

		// если переписать код так, чтобы потребовать на входе p - массив слов (Uint32Array)
		// то можно повысить производительность функции PBKDF2; но к сожалению, это не основная функция в scrypt.
        function blocks(p) {
            let off = 0, len = p.length;
            while (len >= 64) {
                let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7, u, i, j, t1, t2;

				// преобразовываем массив байт в массив слов; w - это внутренний 2048-битный буфер хеш функции SHA-256
                for (i = 0; i < 16; i++) {
                    j = off + i*4;
                    w[i] = ((p[j] & 0xff)<<24) | ((p[j+1] & 0xff)<<16) |
                    ((p[j+2] & 0xff)<<8) | (p[j+3] & 0xff);
                }

                for (i = 16; i < 64; i++) {
                    u = w[i-2];
                    t1 = ((u>>>17) | (u<<(32-17))) ^ ((u>>>19) | (u<<(32-19))) ^ (u>>>10);

                    u = w[i-15];
                    t2 = ((u>>>7) | (u<<(32-7))) ^ ((u>>>18) | (u<<(32-18))) ^ (u>>>3);

                    w[i] = (((t1 + w[i-7]) | 0) + ((t2 + w[i-16]) | 0)) | 0;
                }

				// 64 раунда перемешивания состояния функции при помощи сети Дагмора-Меркла
                for (i = 0; i < 64; i++) {
                    t1 = ((((((e>>>6) | (e<<(32-6))) ^ ((e>>>11) | (e<<(32-11))) ^
                             ((e>>>25) | (e<<(32-25)))) + ((e & f) ^ (~e & g))) | 0) +
                          ((h + ((K[i] + w[i]) | 0)) | 0)) | 0;

                    t2 = ((((a>>>2) | (a<<(32-2))) ^ ((a>>>13) | (a<<(32-13))) ^
                           ((a>>>22) | (a<<(32-22)))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;

                    h = g;
                    g = f;
                    f = e;
                    e = (d + t1) | 0;
                    d = c;
                    c = b;
                    b = a;
                    a = (t1 + t2) | 0;
                }

                h0 = (h0 + a) | 0;
                h1 = (h1 + b) | 0;
                h2 = (h2 + c) | 0;
                h3 = (h3 + d) | 0;
                h4 = (h4 + e) | 0;
                h5 = (h5 + f) | 0;
                h6 = (h6 + g) | 0;
                h7 = (h7 + h) | 0;

                off += 64;
                len -= 64;
            }
        }

        blocks(m);

		let bytesLeft = m.length % 64,
		bitLenLo = m.length << 3,
		numZeros = (bytesLeft < 56) ? 56 : 120;
		
		let a = new Uint8Array( bytesLeft < 56 ? 64 : 128 );
		a.set(m.slice(m.length - bytesLeft))
		a[bytesLeft] = 0x80;
		let v = new DataView(a.buffer);
		v.setUint32(a.length-4, bitLenLo, false);

		blocks(a);

		let r = new Uint32Array(8);
		v = new DataView(r.buffer);
		v.setUint32(0, h0, false);
		v.setUint32(4, h1, false);
		v.setUint32(8, h2, false);
		v.setUint32(12, h3, false);
		v.setUint32(16, h4, false);
		v.setUint32(20, h5, false);
		v.setUint32(24, h6, false);
		v.setUint32(28, h7, false);
		
		return new Uint8Array(r.buffer);
    }




    // N = Cpu cost, r = Memory cost, p = parallelization cost
    // 													 16384,8,1,  32
    function scrypt(password, salt, N, r, p, dkLen) 
	{

        N = ensureInteger(N, 'N');
        r = ensureInteger(r, 'r');
        p = ensureInteger(p, 'p');

        dkLen = ensureInteger(dkLen, 'dkLen');

        if (N === 0 || (N & (N - 1)) !== 0) { throw new Error('N must be power of 2'); }

        if (N > MAX_VALUE / 128 / r) { throw new Error('N too large'); }
        if (r > MAX_VALUE / 128 / p) { throw new Error('r too large'); }

        if (!checkBufferish(password)) {
            throw new Error('password must be an array or buffer');
        }
        password = Array.prototype.slice.call(password);

        if (!checkBufferish(salt)) {
            throw new Error('salt must be an array or buffer');
        }
        salt = Array.prototype.slice.call(salt);

		
		//
		// расширяем один хеш до 1024 байт (по-сути генерируем 32 хеша) - это будет наш начальный супер-блок
		//
        let b = PBKDF2(password, salt, p * 128 * r); //1*128*8 = 1024 bytes
        const B = new Uint32Array(p * 32 * r) // 1*32*8 *4 = 1024 bytes		
        for (let i = 0; i < B.length; i++) 
		{ // кстати этот цикл - это "боль" только разработчиков языков высокого уровня
		  // программисту на C это даже делать не нужно
		  // а схемотехник даже не поймёт о чем вообще тут речь
            const j = i * 4; 
            B[i] = ((b[j + 3] & 0xff) << 24) |
                   ((b[j + 2] & 0xff) << 16) |
                   ((b[j + 1] & 0xff) << 8) |
                   ((b[j + 0] & 0xff) << 0);
        }
		// B - наш первый супер-блок


        const XY = new Uint32Array(64 * r); //временный буфер для обработки одного "супер-блока" 64*8 *4 = 2048 bytes
        const Yi = 32 * r; // я так понял - это размер супер-блока (1024 байт) 32*8 = 256

        // заране выделяем место для функций salsa20_8, blockmix_salsa8 (эти переменные будут использоваться только в них)
			// возможно человек пытался подавить лишнее выделение памяти в Javascript; это может быть оправдано
        const x = new Uint32Array(16);       // это временный буфер для salsa20_8
        const _X = new Uint32Array(16);      // это временный буфер для blockmix_salsa8


		arraycopy(B, 0, XY, 0, Yi); // XY = B  (первый супер-блок равен выходу PBKDF2)

		//
		// выполняем разворачивание 1024 байт до 16Мб
		// 
        const V = new Uint32Array(32 * r * N); // это целевой буфер с которым будем работать 32*8*16384 *4 = 16Mb
		
		for (let i = 0; i < N; i++) 
		{
			arraycopy(XY, 0, V, i * Yi, Yi) // V[i] = XY
			blockmix_salsa8(XY, Yi, r, x, _X); // XY = blockmix_salsa8( XY )
		}

		//
		// теперь эти 16Мб тусуем и "в хвост и в гриву"
		// 
		const offset = (2 * r - 1) << 4; // позиция последнего слова в супер-блоке XY, 
		// которая будет хранить индекс следующего супер-блока из V для смешивания
		
		for (let i = 0; i < N; i++) 
		{
			const j = XY[offset] & (N - 1); // получим индекс супер-блока из V для смешивания
			// кстати, именно здесь Колин Персиваль допустил ошибку. Это участок уязвим к атаке по побочным каналам утечки.
			// применяя атаку вытеснения кеша, можно получить до 14 бит полезной информации, которая поможет
			// раскрыть пароль пользователя. Проще говоря, в деле проверки пароля, мы можем ускориться в 16384 раз.
			// как? берем первый пароль-кандидат для проверки. вычисляем PBKDF2, доходим до этого места,
			// получаем значение j и сверяем с тем, что мы "украли". соль не секретна.
			// но эта атака возможна только на клиенте в момент вычисления им хеша
			// например, в соседней вкладке браузера работает вредоносный скрипт, который "забивает кеш" CPU
			// и измеряет время работы соседней вкладки. есть и другие способы.
					
			// вычисляем XY = blockmix_salsa8( XY xor V[j] )
			blockxor(V, j * Yi, XY, Yi);
			blockmix_salsa8(XY, Yi, r, x, _X);
			
		} // на выходе у нас XY

		// наконец переносим полученное значение из временного супер-блока XY в итоговый супер-блок B
		arraycopy(XY, 0, B, 0, Yi);

		b = [];
		for (let i = 0; i < B.length; i++) {
			b.push((B[i] >>  0) & 0xff);
			b.push((B[i] >>  8) & 0xff);
			b.push((B[i] >> 16) & 0xff);
			b.push((B[i] >> 24) & 0xff);
		}

		// ну и преобразовываем супер-блок b в выходные 32 байта
		return PBKDF2(password, b, dkLen); // это и есть наш результат; всё	просто и примитивно
    }




	/**
	 * Генерирует из логина и соли хеш требуемой длины.
	 * Если длина равна 32, то вычисляет по формуле: SHA256(outerKey | SHA256(innerKey))
	 * Если длина больше 32, то вычисляет серию таких блоков, последовательно увеличивая счетчик
	 * номера блока внутри innerKey.
	 *
	 * password пароль (массив Uint8Array)
	 * salt соль - случайный набор байт для пароля (массив Uint8Array)
	 * dkLen требуемая длина выходного хеша
	 */
    function PBKDF2(password, salt, dkLen) {
        // если пароль длинее 64 байт, сжимаем его до размера блока хеша (32 байта)
        password = (password.length <= 64) ? password : SHA256(password);

        const innerLen = 64 + salt.length + 4; // длина  внутреннего ключа
        const innerKey = new Uint8Array(innerLen);
        const outerKey = new Uint8Array(64);

        let dk = new Uint8Array(dkLen); // это будет результат

        // innerKey = (password ^ ipad) || salt || counter
		innerKey.fill(0x36, 0, 64)
        for (var i = 0; i < password.length; i++) { innerKey[i] ^= password[i]; }
		innerKey.set(salt, 64)

        // outerKey = password ^ opad
		outerKey.fill(0x5c)
        for (var i = 0; i < password.length; i++) outerKey[i] ^= password[i];
		
		var hash_inner;
		var outer;
		var outer_cat = new Uint8Array(outerKey.length + 32); // выносим за цикл инвариант
		outer_cat.set(outerKey);
		var j = 0;

        // вычисляем 32 блока, инкрементируя счетчик innerKey
        while (dkLen > 0) {            
			innerKey[innerLen - 1]++; //т.к. у нас всего будет 32 итерации, достаточно менять только последний байт, а не 4!
			
			// вычисляем SHA256(outerKey | SHA256(innerKey))
			hash_inner = SHA256(innerKey);			
			outer_cat.set(hash_inner, outerKey.length);
			outer = SHA256(outer_cat);
			
			dk.set(outer, j); j += 32; dkLen -= 32;
        }

        return dk;
    }


	/**
	 * Более подробно переработанный алгоритм работы этой функции отражен в анимации animation2_v2.html
	 *
	 * BY (Uint32Array) исходный блок для замешивания
	 * Yi (int) размер блока (1024 байт) 
	 * r (int) параметр scrypt = 8
	 * x (Uint32Array) временный буфер, чтобы V8 не выделял память в цикле; используется внутри salsa20_8
	 * _X (Uint32Array) временный буфер 64 байт для обработки внутри salsa20_8
	 */
    function blockmix_salsa8(BY, Yi, r, x, _X) 
	{
        let i;
        arraycopy(BY, (2 * r - 1) * 16, _X, 0, 16);
		
        for (i = 0; i < 2 * r; i++) 
		{
			// вычисляем BY[i] = salsa20_8( BY[i] xor _X );
            blockxor(BY, i * 16, _X, 16);
            salsa20_8(_X, x);
			
			// сразу вычисляем куда стоит поместить блок
			let pos = (i & 1)*Yi + (i>>1)*16; // избавляемся от копирования лишних 512 байт

            arraycopy(_X, 0, BY, pos, 16); 
        }
		
			// ранее тут было 2 цикла копирования по 64 байта с рандомным доступом к памяти;
			// в результате грамотного выполнения в цикле выше и последовательной упаковки
			arraycopy(BY, Yi, BY, r * 16, 16 * r); // эти циклы были сведены в одно последовательное копирование 512 байт
    }

	// циклический сдвиг a влево на b бит
    function R(a, b) {
        return (a << b) | (a >>> (32 - b));
    }
	
	/**
	 * Выполняет микширование 64 байт из супер-блока.
	 * 4 итерации по 2 раунда смешивания.
	 * На самом деле выполняет обычное сложение, xor и коммутацию бит.
	 * Криптостойкость схемы не доказана. Необратимых операций не используется.
	 *
	 * Функция может быть выполнена на конвейере FGPA/ASIC, что отражено в анимации animation4.html
	 */
    function salsa20_8(B, x) 
	{
        arraycopy(B, 0, x, 0, 16);

		// важно: здесь каждая группа из 4 строк может быть выполнена независимо
		// можно использовать либо многопоточность (ускоримся в 4 раза), либо параллельность на уровне инструкций (ускоримся на 50%)
		// но последнее доступно только на С/C++
		// как ни странно, на Java коде удалось ускориться до 25% за счет такой перестановки
        for (let i = 8; i > 0; i -= 2) 
		{
			
			// этап 1
			
            x[ 4] ^= R(x[ 0] + x[12], 7); // независимый блок А
            x[ 9] ^= R(x[ 5] + x[ 1], 7); // независимый блок В
            x[14] ^= R(x[10] + x[ 6], 7); // независимый блок С
            x[ 3] ^= R(x[15] + x[11], 7); // независимый блок D

            x[ 8] ^= R(x[ 4] + x[ 0], 9);
            x[13] ^= R(x[ 9] + x[ 5], 9);
            x[ 2] ^= R(x[14] + x[10], 9);
            x[ 7] ^= R(x[ 3] + x[15], 9);

            x[12] ^= R(x[ 8] + x[ 4], 13);
            x[ 1] ^= R(x[13] + x[ 9], 13);
            x[ 6] ^= R(x[ 2] + x[14], 13);
            x[11] ^= R(x[ 7] + x[ 3], 13);

            x[ 0] ^= R(x[12] + x[ 8], 18);
            x[ 5] ^= R(x[ 1] + x[13], 18);
            x[10] ^= R(x[ 6] + x[ 2], 18);
            x[15] ^= R(x[11] + x[ 7], 18);
			
			// этап 2
			
            x[ 1] ^= R(x[ 0] + x[ 3], 7); // независимый блок А
            x[ 6] ^= R(x[ 5] + x[ 4], 7); // независимый блок В
            x[11] ^= R(x[10] + x[ 9], 7); // независимый блок С
            x[12] ^= R(x[15] + x[14], 7); // независимый блок D
			
            x[ 2] ^= R(x[ 1] + x[ 0], 9);
            x[ 7] ^= R(x[ 6] + x[ 5], 9);
            x[ 8] ^= R(x[11] + x[10], 9);
            x[13] ^= R(x[12] + x[15], 9);
            
			x[ 3] ^= R(x[ 2] + x[ 1], 13);
            x[ 4] ^= R(x[ 7] + x[ 6], 13);
            x[ 9] ^= R(x[ 8] + x[11], 13);
            x[14] ^= R(x[13] + x[12], 13);
			
            x[ 0] ^= R(x[ 3] + x[ 2], 18);
            x[ 5] ^= R(x[ 4] + x[ 7], 18);
            x[10] ^= R(x[ 9] + x[ 8], 18);
            x[15] ^= R(x[14] + x[13], 18);
        }

        for (let i = 0; i < 16; ++i) {
            B[i] += x[i];
        }
    }

    function blockxor(S, Si, D, len) {
        for (let i = 0; i < len; i++) {
            D[i] ^= S[Si + i]
        }
    }

    function arraycopy(src, srcPos, dest, destPos, length) {
        while (length--) {
            dest[destPos++] = src[srcPos++];
        }
    }

    function checkBufferish(o) {
        if (!o || typeof(o.length) !== 'number') { return false; }

        for (let i = 0; i < o.length; i++) {
            const v = o[i];
            if (typeof(v) !== 'number' || v % 1 || v < 0 || v >= 256) {
                return false;
            }
        }

        return true;
    }

    function ensureInteger(value, name) {
        if (typeof(value) !== "number" || (value % 1)) { throw new Error('invalid ' + name); }
        return value;
    }





    // node.js
    if (typeof(exports) !== 'undefined') {
       module.exports = scrypt;

    // RequireJS/AMD
    // http://www.requirejs.org/docs/api.html
    // https://github.com/amdjs/amdjs-api/wiki/AMD
    } else if (typeof(define) === 'function' && define.amd) {
        define(scrypt);

    // Web Browsers
    } else if (root) {

        // If there was an existing library "scrypt", make sure it is still available

        root.scrypt4 = scrypt;
    }

})(this);
