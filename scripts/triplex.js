//rounding function
//s = spacing of the values it can round to
//o = offset of the values
function roundVal(x, s, o) {
	s = s || 1.;
	o = o || 0.;
	return Math.round((x - o) / s) * s + o;
}

//computes rounding error
function roundValError(x, s, o) {
	return x - roundVal(x, s, o);
}

//number of barrels
var numBarrels = 3;
var barrelSeparation = 360 / numBarrels;

extendContent(BurstTurret, "triplex-turret", {
	update(tile) {
		var ent = tile.ent();
		var tilex = tile.drawx();
		var tiley = tile.drawy();
		//if current rotation isnt defined, set it to 0
		if (isNaN(ent.rotation)) ent.rotation = 0;
		//if target isnt valid, set it to null
		if (!this.validateTarget(tile)) ent.target = null;

		//cool down the turret a bit every frame
		ent.heat = Mathf.lerpDelta(ent.heat, 0., this.cooldown);

		//if we have ammo, continue
		if (!this.hasAmmo(tile)) return;

		//find a new target
		if (ent.timer.get(this.timerTarget, this.targetInterval)) this.findTarget(tile);
		if (!this.validateTarget(tile)) return;

		var bulletType = this.peekAmmo(tile);

		//intercept the enemy based on enemy pos & velocity, turret pos, and bullet speed
		var res = Predict.intercept(ent, ent.target, bulletType.speed);
		//if we cant intercept, then just aim straight at the enemy
		if (res.isZero()) res.set(ent.target.getX(), ent.target.getY());
		var targetRot = res.sub(tilex, tiley).angle();

		//turn to the target
		this.turnToTarget(tile, roundVal(ent.rotation, barrelSeparation, targetRot));

		//if the target is within one of the shoot cones, then shoot
		if (!(roundValError(Angles.angleDist(ent.rotation, targetRot), barrelSeparation) < this.shootCone)) return;

		//check if the turret has reloaded, if it has then shoot bullets, otherwise see line 77
		if (ent.reload >= this.reload) {
			//set heat to the maximum, because we are about to shoot bullets
			ent.heat = 1.;

			//shoot multiple shots, each one after another
			for (var shot = 0; shot < this.shots; shot++) {
				Time.run(this.burstSpacing * shot, run(() => {
					//if the turret hasnt been deleted, and has ammo, continue
					if(!((tile.entity instanceof Turret.TurretEntity) && this.hasAmmo(tile))) return;

					//shoot a bullet out of each barrel
					for (var i = 0; i < numBarrels; i++) {
						var rot = i * barrelSeparation;
						this.tr.trns(ent.rotation + rot, this.size * Vars.tilesize / 2., Mathf.range(this.xRand));
						this.bullet(tile, bulletType, ent.rotation + rot + Mathf.range(this.inaccuracy + bulletType.inaccuracy));
						//add effects and use up ammo
						var shootEffect = this.shootEffect === Fx.none ? bulletType.shootEffect : this.shootEffect;
						var smokeEffect = this.smokeEffect === Fx.none ? bulletType.smokeEffect : this.smokeEffect;
						Effects.effect(shootEffect, tilex + this.tr.x, tiley + this.tr.y, ent.rotation + rot);
						Effects.effect(smokeEffect, tilex + this.tr.x, tiley + this.tr.y, ent.rotation + rot);
						if (this.shootShake > 0.) Effects.shake(shootShake, shootShake, tile.entity);
						this.useAmmo(tile);
					}
					this.shootSound.at(tile, Mathf.random(0.9, 1.1));
				}));
			}

			//the turret has shot, we need to reload again
			ent.reload = 0.;
		} else {
			//we havent reloaded yet fully, reload some more
			ent.reload += tile.entity.delta() * bulletType.reloadMultiplier * this.baseReloadSpeed(tile);
		}
	}
});
