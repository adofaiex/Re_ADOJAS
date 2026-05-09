using System;
using System.Collections.Generic;
using ADOFAI;
using DG.Tweening;
using DG.Tweening.Core;
using DG.Tweening.Plugins.Options;
using UnityEngine;

// Token: 0x0200015D RID: 349
public class ffxMoveFloorPlus : ffxPlusBase
{
	// Token: 0x17000123 RID: 291
	// (get) Token: 0x06000898 RID: 2200 RVA: 0x00071320 File Offset: 0x0006F520
	protected override IEnumerable<Tween> eventTweens
	{
		get
		{
			List<Tween> list = new List<Tween>();
			List<scrFloor> listFloors = this.levelMaker.listFloors;
			for (int i = this.start; i <= this.end; i += 1 + this.gapLength)
			{
				scrFloor scrFloor = listFloors[i];
				list.AddRange(scrFloor.moveTweens.Values);
			}
			return list;
		}
	}

	// Token: 0x06000899 RID: 2201 RVA: 0x00021CD9 File Offset: 0x0001FED9
	public override void Awake()
	{
		base.Awake();
		this.levelMaker = ADOBase.lm;
	}

	// Token: 0x0600089A RID: 2202 RVA: 0x00021CEC File Offset: 0x0001FEEC
	private void Start()
	{
		if (!float.IsNaN(this.targetScale))
		{
			this.targetScaleV2 = new Vector2(this.targetScale, this.targetScale);
		}
	}

	// Token: 0x0600089B RID: 2203 RVA: 0x00071378 File Offset: 0x0006F578
	public override void StartEffect()
	{
		base.AdjustDurationForHardbake();
		if (this.end < this.start)
		{
			int num = this.end;
			this.end = this.start;
			this.start = num;
		}
		Vector3 vector = new Vector3(this.targetPos.x, this.targetPos.y, 0f);
		Vector3 vector2 = new Vector3(0f, 0f, this.targetRot);
		Vector3 vector3 = new Vector3(this.targetScaleV2.x, this.targetScaleV2.y, 1f);
		List<scrFloor> listFloors = this.levelMaker.listFloors;
		for (int i = this.start; i <= this.end; i += 1 + this.gapLength)
		{
			scrFloor target = listFloors[i];
			Transform targetTransform = target.transform;
			Material material = target.floorRenderer.material;
			Dictionary<global::TweenType, Tween> moveTweens = target.moveTweens;
			Vector3 vector4 = target.startPos + vector;
			float z = (target.startRot + vector2).z;
			if (this.positionUsed)
			{
				if (!float.IsNaN(vector4.x))
				{
					if (moveTweens.ContainsKey(global::TweenType.PositionX))
					{
						moveTweens[global::TweenType.PositionX].Kill(true);
					}
					if (!Mathf.Approximately(targetTransform.position.x, vector4.x))
					{
						moveTweens[global::TweenType.PositionX] = DOTween.To(() => targetTransform.position.x, delegate(float x)
						{
							targetTransform.MoveX(x);
						}, vector4.x, this.duration).SetEase(this.ease).Done<TweenerCore<float, float, FloatOptions>>();
					}
				}
				if (!float.IsNaN(vector4.y))
				{
					if (moveTweens.ContainsKey(global::TweenType.PositionY))
					{
						moveTweens[global::TweenType.PositionY].Kill(true);
					}
					if (!Mathf.Approximately(targetTransform.position.y, vector4.y))
					{
						moveTweens[global::TweenType.PositionY] = DOTween.To(() => targetTransform.position.y, delegate(float y)
						{
							targetTransform.MoveY(y);
						}, vector4.y, this.duration).SetEase(this.ease).Done<TweenerCore<float, float, FloatOptions>>();
					}
				}
			}
			if (this.rotationUsed)
			{
				if (moveTweens.ContainsKey(global::TweenType.Rotation))
				{
					moveTweens[global::TweenType.Rotation].Kill(true);
				}
				if (!Mathf.Approximately(targetTransform.eulerAngles.z, z))
				{
					moveTweens[global::TweenType.Rotation] = DOTween.To(() => target.tweenRot.z, delegate(float r)
					{
						target.tweenRot.z = r;
					}, (target.startRot + vector2).z, this.duration).SetEase(this.ease).OnUpdate(delegate
					{
						targetTransform.eulerAngles = target.tweenRot;
					})
						.Done<TweenerCore<float, float, FloatOptions>>();
				}
			}
			if (this.scaleUsed)
			{
				Vector3 localScale = targetTransform.localScale;
				if (!float.IsNaN(vector3.x))
				{
					Tween valueOrDefault = moveTweens.GetValueOrDefault(global::TweenType.ScaleX);
					if (valueOrDefault != null)
					{
						valueOrDefault.Kill(true);
					}
					Vector3 vector5 = localScale.WithX(vector3.x);
					if (!targetTransform.localScale.ApproximatelyXY(vector5))
					{
						moveTweens[global::TweenType.ScaleX] = targetTransform.DOScale(vector5, this.duration).SetEase(this.ease).SetOptions(AxisConstraint.X, false)
							.Done<Tweener>();
					}
				}
				if (!float.IsNaN(vector3.y))
				{
					Tween valueOrDefault2 = moveTweens.GetValueOrDefault(global::TweenType.ScaleY);
					if (valueOrDefault2 != null)
					{
						valueOrDefault2.Kill(true);
					}
					Vector3 vector6 = localScale.WithY(vector3.y);
					if (!targetTransform.localScale.ApproximatelyXY(vector6))
					{
						moveTweens[global::TweenType.ScaleY] = targetTransform.DOScale(vector6, this.duration).SetEase(this.ease).SetOptions(AxisConstraint.Y, false)
							.Done<Tweener>();
					}
				}
			}
			if (this.opacityUsed)
			{
				if (moveTweens.ContainsKey(global::TweenType.Opacity))
				{
					moveTweens[global::TweenType.Opacity].Kill(true);
				}
				if (!Mathf.Approximately(target.opacity, this.targetOpacity))
				{
					Tween tween = target.TweenOpacity(this.targetOpacity, this.duration, this.ease);
					if (tween != null)
					{
						moveTweens[global::TweenType.Opacity] = tween;
					}
				}
			}
		}
	}

	// Token: 0x0600089C RID: 2204 RVA: 0x000717F8 File Offset: 0x0006F9F8
	public override void Decode(LevelEvent evnt)
	{
		this.duration = evnt.GetFloat("duration") * this.crotchet;
		Tuple<int, TileRelativeTo> tuple = evnt.data["startTile"] as Tuple<int, TileRelativeTo>;
		this.start = scnGame.IDFromTile(tuple, this.floorID, this.floors);
		Tuple<int, TileRelativeTo> tuple2 = evnt.data["endTile"] as Tuple<int, TileRelativeTo>;
		this.end = scnGame.IDFromTile(tuple2, this.floorID, this.floors);
		if (evnt.data.ContainsKey("gapLength"))
		{
			this.gapLength = evnt.GetInt("gapLength");
		}
		Vector2 vector = (Vector2)evnt.data["positionOffset"];
		this.targetPos = ADOBase.controller.tileSize * vector;
		this.positionUsed = !evnt.disabled["positionOffset"];
		this.targetRot = evnt.GetFloat("rotationOffset");
		this.rotationUsed = !evnt.disabled["rotationOffset"];
		this.targetScaleV2 = (Vector2)evnt.data["scale"] / 100f;
		this.scaleUsed = !evnt.disabled["scale"];
		this.targetOpacity = evnt.GetFloat("opacity") / 100f;
		this.opacityUsed = !evnt.disabled["opacity"];
		if (evnt.data.ContainsKey("maxVfxOnly"))
		{
			this.disableIfMinFx = evnt.GetBool("maxVfxOnly");
		}
		this.ease = (Ease)evnt.data["ease"];
	}

	// Token: 0x04000B64 RID: 2916
	private scrLevelMaker levelMaker;

	// Token: 0x04000B65 RID: 2917
	public int start;

	// Token: 0x04000B66 RID: 2918
	public int end;

	// Token: 0x04000B67 RID: 2919
	public Vector2 targetPos;

	// Token: 0x04000B68 RID: 2920
	public bool positionUsed = true;

	// Token: 0x04000B69 RID: 2921
	public float targetRot;

	// Token: 0x04000B6A RID: 2922
	public bool rotationUsed = true;

	// Token: 0x04000B6B RID: 2923
	public float targetScale = float.NaN;

	// Token: 0x04000B6C RID: 2924
	public Vector2 targetScaleV2;

	// Token: 0x04000B6D RID: 2925
	public bool scaleUsed = true;

	// Token: 0x04000B6E RID: 2926
	public float targetOpacity;

	// Token: 0x04000B6F RID: 2927
	public bool opacityUsed = true;

	// Token: 0x04000B70 RID: 2928
	public int gapLength;
}
