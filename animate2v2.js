(function()
{
var buffer = document.querySelectorAll('.operation-line *');
var x_block = document.querySelector('#x_block');
var inform = document.querySelector('#inform');
var bplay = document.querySelector('#play');
var bpause = document.querySelector('#pause');
var lines = document.querySelectorAll('pre span');

var BY = [], X = 0, animation, tm;
init();
colorize();
x_block.style.display = 'none';

animation = makeAnimation();
animation.play();



window.toggleAnimation = function()
{
	if ( animation != undefined ) 
	{
		if ( animation.isPaused() )
		{
			animation.resume();
			bpause.innerText = 'Пауза';
		}

		else
		{
			animation.pause();	
			bpause.innerText = 'Продолжить';			
		}
	}
}

window.startAnimation = function()
{
	if ( animation != undefined )
	{
		animation.stop();
		animation = undefined;
		if ( tm != undefined ) clearTimeout(tm);
		reset();
		
	}
	else
	{
		reset();
		animation = makeAnimation();
		animation.play();
	}
}

function reset()
{
	for (var i = 0; i < 16; i++)
		buffer[i].style.transform = '';	

	x_block.style.display = 'none';
	x_block.style.transform = 'translate(570px, 0)';
	x_block.style.backgroundColor = '#' + BY[15].toString(16);
	bpause.innerText = 'Пауза';
}




// создает общую анимацию
function makeAnimation()
{
	// двигаем X вниз
	var a1 = new Animation2({
		from: -38, to: 0, delay: 0.5, duration: 0.4, 
		start: () => {
			x_block.style.display = 'inline-block';
			x_block.style.backgroundColor = '#' + BY[15].toString(16);
			
			bplay.innerText = 'Остановить';
			bpause.removeAttribute('hidden');
			selectLine(0);
		},
		step: function(a, y) {
			x_block.style.transform = 'translate(570px, ' + y + 'px)'		
		},
	})
	// перемещаем X в начальную позицию
	var a2 = new Animation2({
		from: 15*38, to: 0, delay: 0.2, duration: 0.6, 
		start: () => {
			x_block.style.backgroundColor = '#' + BY[15].toString(16);
			inform.innerHTML = 'Устанавливаем X = B<sub>15</sub>';
		},
		step: function(a, x) {
			x_block.style.transform = 'translateX(' + x + 'px)'
		},
		done: () => { 
			X ^= BY[15];
			x_block.style.backgroundColor = '#' + X.toString(16);
		}
	})

	var n = a1.next(a2);

	for (var i = 0; i < 16; i+=2)
	{
		var mix = makeEvenAni(i);
		n.next(mix.start)
		n = mix.end;
		
		var mix = makeOddAni(i+1);
		n.next(mix.start)
		n = mix.end;
	}
	n.ondone = function()
	{
		//x_block.style.display = 'none';
	}

	for (var i = 1; i < 16; i+=2)
	{
		var move = makeCopyAny(i);
		n = n.next(move);
	}
	n.ondone = function()
	{
		bplay.innerText = 'Начать';
		bpause.setAttribute('hidden', '');
		animation = undefined;
		selectLine(-1);
		/*tm = setTimeout(function(){
			animation = makeAnimation();
			animation.play();
		}, 1000)*/
		inform.innerHTML = 'Готово';
	}
	return a1;
}

// создает анимацию трансформации четного блока
function makeEvenAni(i)
{
	// опускаем блок вниз
	var a3 = new Animation2({
		from: 0, to: 38, delay: 0.2, duration: 0.4, 
		start: () => { 
			inform.innerHTML = 'Смешиваем: X = salsa20_8( B<sub>'+i+'</sub> &oplus; X ) ';
			selectLine(1);
		},
		step: function(a, y) {
			buffer[i].style.transform = 'translateY(' + y + 'px)'
		},
		done: () => { 
			var c = rndcolor();
			x_block.style.backgroundColor = '#' + c.toString(16);
			buffer[i].style.backgroundColor = '#' + c.toString(16);
			selectLine(2);
		},
	})
	// вращаем 1
	var a4 = new Animation2({
		from: 0, to: 180, delay: 0.2, duration: 0.4, obj: { t: '' },
		start: (a) => { a.obj.t = buffer[i].style.transform },
		step: function(a, r) {
			buffer[i].style.transform = a.obj.t + ' rotate(' + r + 'deg)';
		},
		done: (a) => { 
			var c = rndcolor();
			x_block.style.backgroundColor = '#' + c.toString(16);
			buffer[i].style.backgroundColor = '#' + c.toString(16);
			buffer[i].style.transform = a.obj.t
		},
	})
	// вращаем 2
	var a5 = new Animation2({
		from: 0, to: 180, delay: 0.2, duration: 0.4, obj: { t: '' },
		start: (a) => { a.obj.t = buffer[i].style.transform },
		step: function(a, r) {
			buffer[i].style.transform = a.obj.t + ' rotate(' + r + 'deg)';
		},
		done: (a) => { 
			X ^= BY[i];
			x_block.style.backgroundColor = '#' + X.toString(16);
			buffer[i].style.backgroundColor = '#' + X.toString(16);
			buffer[i].style.transform = a.obj.t
		},
	})
	// двигаем блок влево, а X двигаем вправо
	var a6 = new Animation2({
		from: {b: 0, x: i*38}, to: {b: -38*(i>>1), x: (i+1)*38}, delay: 0.2, duration: 0.2, 
		start: () => { 
			inform.innerHTML = 'Записываем блок '+i+' во в ячейку B<sub>'+(i>>1)+'</sub>';
			selectLine(3);
		},
		step: function(a, v) {
			buffer[i].style.transform = 'translate(' + v.b + 'px, 38px)'
			x_block.style.transform = 'translateX(' + v.x + 'px)'
		},
		done: function(a) {
			
		},
	})
	// поднимаем блок вверх
	var a7 = new Animation2({
		from: 38, to: 0, delay: 0.0, duration: 0.4,
		start: (a) => { 
			inform.innerHTML = 'Записываем блок '+i+' во в ячейку B<sub>'+(i>>1)+'</sub>';
		},
		step: function(a, y) {
			buffer[i].style.transform = 'translate(' + (-38*(i>>1)) + 'px, ' + y + 'px)'
			
		},
	})
	
	return {start: a3, end: a3.next(a4).next(a5).next(a6).next(a7)};
}

// создает анимацию трансформации нечетного блока
function makeOddAni(i)
{
	// опускаем блок вниз
	var a3 = new Animation2({
		from: 0, to: 38, delay: 0.2, duration: 0.4, 
		start: () => { 
			inform.innerHTML = 'Смешиваем: X = salsa20_8( B<sub>'+i+'</sub> &oplus; X ) ';
			selectLine(1);
		},
		step: function(a, y) {
			buffer[i].style.transform = 'translateY(' + y + 'px)'
		},
		done: () => { 
			var c = rndcolor();
			x_block.style.backgroundColor = '#' + c.toString(16);
			buffer[i].style.backgroundColor = '#' + c.toString(16);
			selectLine(2);
		},
	})
	// вращаем 1
	var a4 = new Animation2({
		from: 0, to: 180, delay: 0.2, duration: 0.4, obj: { t: '' },
		start: (a) => { a.obj.t = buffer[i].style.transform },
		step: function(a, r) {
			buffer[i].style.transform = a.obj.t + ' rotate(' + r + 'deg)';
		},
		done: (a) => { 
			var c = rndcolor();
			x_block.style.backgroundColor = '#' + c.toString(16);
			buffer[i].style.backgroundColor = '#' + c.toString(16);
			buffer[i].style.transform = a.obj.t
		},
	})
	// вращаем 2
	var a5 = new Animation2({
		from: 0, to: 180, delay: 0.2, duration: 0.4, obj: { t: '' },
		start: (a) => { a.obj.t = buffer[i].style.transform },
		step: function(a, r) {
			buffer[i].style.transform = a.obj.t + ' rotate(' + r + 'deg)';
		},
		done: (a) => { 
			X ^= BY[i];
			x_block.style.backgroundColor = '#' + X.toString(16);
			buffer[i].style.backgroundColor = '#' + X.toString(16);
			buffer[i].style.transform = a.obj.t
		},
	})
	// уносим блок сильно вправо
	var a6 = new Animation2({
		from: 0, to: 1, delay: 0.2, duration: 0.4, 
		start: () => { 
			inform.innerHTML = 'Записываем блок '+i+' во временную ячейку B<sub>'+((i>>1)+16)+'</sub>';
			selectLine(3);
		},
		step: function(a, v) {
			var x1 = (16 - (i>>1))*(38*v);
			var x2 = i*38 + v*38			
			buffer[i].style.transform = 'translate(' + x1 + 'px, 38px)'
			
		},
	})	
	// поднимаем блок вверх, а X двигаем вправо
	var a7 = new Animation2({
		from: 38, to: 0, delay: 0.0, duration: 0.4, obj: {x: 0},
		start: (a) => { a.obj.x = (16 - (i>>1))*38 },
		step: function(a, y) {
			var x2 = i*38 + (38-y);
			buffer[i].style.transform = 'translate(' + a.obj.x + 'px, ' + y + 'px)'
			x_block.style.transform = 'translateX(' + x2 + 'px)'
		},
	})	
	
	return {start: a3, end: a3.next(a4).next(a5).next(a6).next(a7)};
}

// создает анимацию перемещения блока из старшой половины в младшую
function makeCopyAny(i)
{
	var pos = (i>>1) + 8;
	var x1 = (16 - (i>>1))*38;
	var x2 = (7-(i>>1))*38;
	
	// перемещаем блок влево
	var a3 = new Animation2({
		from: x1, to: x2, delay: 0.2, duration: 0.4, 
		start: () => { 
			inform.innerHTML = 'Перемещам блок '+i+' на позицию '+pos;
			selectLine(4);
		},
		step: function(a, x) {
			buffer[i].style.transform = 'translateX(' + x + 'px)'
		},
	})	
	return a3;
}


function colorize()
{
	for (var i = 0; i < 16; i++)
		buffer[i].style.backgroundColor = '#' + BY[i].toString(16);
}
function init()
{
for (var i = 0; i < 16; i++)
	BY[i] = rndcolor();

for (var i = 16; i < 32; i++)
	BY[i] = 0;
}
function rndcolor()
{
	return Math.trunc(Math.random()*(256**3)) | 0x404040;
}
function selectLine(num)
{
	for (var i = 0; i < lines.length; i++)
		if ( i == num )
			lines[i].classList.add('active');
		else
			lines[i].classList.remove('active');
}
	
})();