const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Set and maintain canvas size
function resizeCanvas() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Controls state
const keys = { up: false, down: false, left: false, right: false };

// Player object
const player = {
	x: window.innerWidth / 2,
	y: window.innerHeight / 2,
	width: 40,
	height: 40,
	color: "#0f0",
	speed: 4,
};

// Draw background
function drawBackground() {
	ctx.fillStyle = "#1e1e1e";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Draw player
function drawPlayer() {
	ctx.fillStyle = player.color;
	ctx.fillRect(player.x, player.y, player.width, player.height);
}

// Update movement
function update() {
	if (keys.up) player.y -= player.speed;
	if (keys.down) player.y += player.speed;
	if (keys.left) player.x -= player.speed;
	if (keys.right) player.x += player.speed;

	// Optional: boundary limits
	player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
	player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
}

// Game loop
function gameLoop() {
	update();
	drawBackground();
	drawPlayer();
	requestAnimationFrame(gameLoop);
}
gameLoop();

// --- Mobile Button Controls ---
window.move = function (dir) {
	switch (dir) {
		case "up":
			keys.up = true;
			setTimeout(() => (keys.up = false), 100);
			break;
		case "down":
			keys.down = true;
			setTimeout(() => (keys.down = false), 100);
			break;
		case "left":
			keys.left = true;
			setTimeout(() => (keys.left = false), 100);
			break;
		case "right":
			keys.right = true;
			setTimeout(() => (keys.right = false), 100);
			break;
	}
};

// --- Touch Swipe Controls ---
let touchStartX = 0,
	touchStartY = 0;
canvas.addEventListener("touchstart", (e) => {
	touchStartX = e.touches[0].clientX;
	touchStartY = e.touches[0].clientY;
});
canvas.addEventListener("touchend", (e) => {
	const deltaX = e.changedTouches[0].clientX - touchStartX;
	const deltaY = e.changedTouches[0].clientY - touchStartY;

	if (Math.abs(deltaX) > Math.abs(deltaY)) {
		move(deltaX > 0 ? "right" : "left");
	} else {
		move(deltaY > 0 ? "down" : "up");
	}
});
