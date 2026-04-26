using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using UnityEngine;

// Token: 0x02000388 RID: 904
[ExecuteInEditMode]
public class FloorMesh : MonoBehaviour
{
	// Token: 0x17000273 RID: 627
	// (get) Token: 0x060015EB RID: 5611 RVA: 0x0002AFE1 File Offset: 0x000291E1
	// (set) Token: 0x060015EC RID: 5612 RVA: 0x0002AFE9 File Offset: 0x000291E9
	public float _angle0
	{
		get
		{
			return this.angle0;
		}
		set
		{
			if (!Mathf.Approximately(value, this.angle0))
			{
				this.angle0 = value;
				this.meshChanged = true;
			}
		}
	}

	// Token: 0x17000274 RID: 628
	// (get) Token: 0x060015ED RID: 5613 RVA: 0x0002B007 File Offset: 0x00029207
	// (set) Token: 0x060015EE RID: 5614 RVA: 0x0002B00F File Offset: 0x0002920F
	public float _angle1
	{
		get
		{
			return this.angle1;
		}
		set
		{
			if (!Mathf.Approximately(value, this.angle1))
			{
				this.angle1 = value;
				this.meshChanged = true;
			}
		}
	}

	// Token: 0x17000275 RID: 629
	// (get) Token: 0x060015EF RID: 5615 RVA: 0x0002B02D File Offset: 0x0002922D
	// (set) Token: 0x060015F0 RID: 5616 RVA: 0x0002B035 File Offset: 0x00029235
	public float _width
	{
		get
		{
			return this.width;
		}
		set
		{
			if (!Mathf.Approximately(value, this.width))
			{
				this.width = value;
				this.meshChanged = true;
			}
		}
	}

	// Token: 0x17000276 RID: 630
	// (get) Token: 0x060015F1 RID: 5617 RVA: 0x0002B053 File Offset: 0x00029253
	// (set) Token: 0x060015F2 RID: 5618 RVA: 0x0002B05B File Offset: 0x0002925B
	public float _length
	{
		get
		{
			return this.length;
		}
		set
		{
			if (!Mathf.Approximately(value, this.length))
			{
				this.length = value;
				this.meshChanged = true;
			}
		}
	}

	// Token: 0x17000277 RID: 631
	// (get) Token: 0x060015F3 RID: 5619 RVA: 0x0002B079 File Offset: 0x00029279
	// (set) Token: 0x060015F4 RID: 5620 RVA: 0x0002B081 File Offset: 0x00029281
	public int _curvaturePoints
	{
		get
		{
			return this.curvaturePoints;
		}
		set
		{
			if (this.curvaturePoints != value)
			{
				this.curvaturePoints = value;
				this.meshChanged = true;
			}
		}
	}

	// Token: 0x17000278 RID: 632
	// (get) Token: 0x060015F5 RID: 5621 RVA: 0x0002B09A File Offset: 0x0002929A
	// (set) Token: 0x060015F6 RID: 5622 RVA: 0x0002B0A2 File Offset: 0x000292A2
	public bool _isSprite
	{
		get
		{
			return this.isSprite;
		}
		set
		{
			if (this.isSprite != value)
			{
				this.isSprite = value;
				this.meshChanged = true;
			}
		}
	}

	// Token: 0x17000279 RID: 633
	// (get) Token: 0x060015F7 RID: 5623 RVA: 0x0002B0BB File Offset: 0x000292BB
	// (set) Token: 0x060015F8 RID: 5624 RVA: 0x0002B0C3 File Offset: 0x000292C3
	public bool _isHexagon
	{
		get
		{
			return this.isHexagon;
		}
		set
		{
			if (this.isHexagon != value)
			{
				this.isHexagon = value;
				this.meshChanged = true;
			}
		}
	}

	// Token: 0x1700027A RID: 634
	// (get) Token: 0x060015F9 RID: 5625 RVA: 0x0002B0DC File Offset: 0x000292DC
	// (set) Token: 0x060015FA RID: 5626 RVA: 0x0002B0E4 File Offset: 0x000292E4
	public bool _useFInset2
	{
		get
		{
			return this.useFInset2;
		}
		set
		{
			this.useFInset2 = value;
			this.meshChanged = true;
		}
	}

	// Token: 0x1700027B RID: 635
	// (set) Token: 0x060015FB RID: 5627 RVA: 0x0002B0F4 File Offset: 0x000292F4
	public bool meshChanged
	{
		set
		{
			FloorMesh.floorMeshesThatNeedUpdate.Add(this);
		}
	}

	// Token: 0x060015FC RID: 5628 RVA: 0x0002B102 File Offset: 0x00029302
	private void Awake()
	{
		this.meshFilter = base.GetComponent<MeshFilter>();
		this.meshRenderer = base.GetComponent<MeshRenderer>();
		this.meshChanged = true;
	}

	// Token: 0x060015FD RID: 5629 RVA: 0x000B54E4 File Offset: 0x000B36E4
	public static void UpdateAllRequired()
	{
		foreach (FloorMesh floorMesh in FloorMesh.floorMeshesThatNeedUpdate)
		{
			if (floorMesh)
			{
				floorMesh.UpdateMesh();
			}
		}
		FloorMesh.floorMeshesThatNeedUpdate.Clear();
	}

	// Token: 0x060015FE RID: 5630 RVA: 0x000B5548 File Offset: 0x000B3748
	public void UpdateMesh()
	{
		this.cacheKey = (this.isHexagon ? "hexagon" : (this.isSprite ? "sprite" : string.Format("{0},{1},{2},{3},{4}", new object[] { this.angle0, this.angle1, this.width, this.length, this.curvaturePoints })));
		if (!FloorMesh.cache.ContainsKey(this.cacheKey))
		{
			if (!this._isSprite && !this._isHexagon)
			{
				this.GetPositions(this.angle0 * 0.017453292f, this.angle1 * 0.017453292f, this.width, this.length, this.curvaturePoints);
			}
			this.GenerateMesh();
		}
		FloorMesh.MeshCache meshCache = FloorMesh.cache[this.cacheKey];
		this.meshFilter.mesh = meshCache.mesh;
	}

	// Token: 0x060015FF RID: 5631 RVA: 0x000B564C File Offset: 0x000B384C
	public void GenerateCollider()
	{
		if (FloorMesh.cache.ContainsKey(this.cacheKey))
		{
			FloorMesh.MeshCache meshCache = FloorMesh.cache[this.cacheKey];
			this.polygonCollider.points = meshCache.polygon;
		}
	}

	// Token: 0x06001600 RID: 5632 RVA: 0x000B5690 File Offset: 0x000B3890
	private void KnitTriangles(List<Vector2> polygon, List<int> connections, int insetPolygonCount, int offset, bool sp = false)
	{
		int count = polygon.Count;
		int num = 0;
		while (num < polygon.Count && num < connections.Count)
		{
			int num2 = connections[num];
			if (num2 <= 10000)
			{
				FloorMesh.meshIndices.Add(offset + num);
				FloorMesh.meshIndices.Add(offset + count + num2);
				FloorMesh.meshIndices.Add(offset + (num + 1) % polygon.Count);
				int num3 = connections[(num + 1) % connections.Count];
				if (num3 != num2 && num3 >= 0)
				{
					FloorMesh.meshIndices.Add(offset + (num + 1) % polygon.Count);
					FloorMesh.meshIndices.Add(offset + count + num2);
					FloorMesh.meshIndices.Add(offset + count + (num2 + 1) % insetPolygonCount);
				}
			}
			num++;
		}
	}

	// Token: 0x06001601 RID: 5633 RVA: 0x000B5764 File Offset: 0x000B3964
	public void GenerateMesh()
	{
		Mesh mesh = new Mesh();
		List<Vector3> list = new List<Vector3>();
		List<Color> list2 = new List<Color>();
		FloorMesh.MeshCache meshCache = new FloorMesh.MeshCache();
		FloorMesh.uvs = new List<Vector2>();
		FloorMesh.uvs2 = new List<Vector2>();
		FloorMesh.polygons.Clear();
		List<List<Vector2>> list3 = new List<List<Vector2>>();
		if (this.isHexagon)
		{
			FloorMesh.meshIndices.Clear();
			Vector2[] array = new Vector2[6];
			Vector2[] array2 = new Vector2[6];
			Vector2[] array3 = new Vector2[6];
			Vector2[] array4 = new Vector2[6];
			int[] array5 = new int[6];
			int[] array6 = new int[6];
			for (int i = 0; i < 6; i++)
			{
				array[i] = FloorMesh.<GenerateMesh>g__GenerateNthVertex|102_0(i, 0f);
				array2[i] = FloorMesh.<GenerateMesh>g__GenerateNthVertex|102_0(i, this.length);
				array5[i] = i;
				array3[i] = FloorMesh.<GenerateMesh>g__GenerateNthVertex|102_0(i, this.length);
				array4[i] = FloorMesh.<GenerateMesh>g__GenerateNthVertex|102_0(i, this.length + 0.11f);
				array6[i] = i;
			}
			this.KnitTriangles(new List<Vector2>(array2), new List<int>(array5), 6, 0, false);
			this.KnitTriangles(new List<Vector2>(array4), new List<int>(array6), 6, 12, false);
			meshCache.polygon = (Vector2[])array2.Clone();
			List<Vector2> list4 = new List<Vector2>();
			list4.AddRange(array2);
			list4.AddRange(array);
			list4.AddRange(array3);
			list4.AddRange(array4);
			Vector3[] array7 = new Vector3[24];
			for (int j = 0; j < list4.Count; j++)
			{
				array7[j] = new Vector3(list4[j].x, list4[j].y, 0f);
			}
			mesh.vertices = array7;
			MonoBehaviour.print("All Vertices:");
			for (int k = 0; k < list4.Count; k++)
			{
				MonoBehaviour.print(list4[k]);
			}
			Color[] array8 = new Color[24];
			Vector2[] array9 = new Vector2[24];
			Vector2[] array10 = new Vector2[24];
			mesh.SetIndices(FloorMesh.meshIndices.ToArray(), MeshTopology.Triangles, 0);
			MonoBehaviour.print("Indices:");
			for (int l = 0; l < FloorMesh.meshIndices.Count; l++)
			{
				MonoBehaviour.print(FloorMesh.meshIndices[l]);
			}
			for (int m = 0; m < mesh.vertices.Length; m++)
			{
				array8[m] = Color.white;
				if (m < 6)
				{
					array9[m] = new Vector2(0.5f, 1f);
				}
				else if (m < 12)
				{
					array9[m] = new Vector2(0.5f, 0f);
				}
				else if (m < 18)
				{
					array9[m] = new Vector2(0.5f, 1f);
				}
				else if (m < 24)
				{
					array9[m] = new Vector2(0.5f, 2f);
				}
				array10[m] = mesh.vertices[m].xy();
			}
			mesh.uv = array9;
			mesh.uv2 = array10;
			mesh.colors = array8;
			MonoBehaviour.print("Vertices:");
			for (int n = 0; n < mesh.vertices.Length; n++)
			{
				MonoBehaviour.print(mesh.vertices[n]);
			}
			meshCache.mesh = mesh;
			FloorMesh.cache[this.cacheKey] = meshCache;
			return;
		}
		if (this.isSprite)
		{
			meshCache.polygon = new Vector2[]
			{
				new Vector2(0.5f, 0.5f),
				new Vector2(-0.5f, 0.5f),
				new Vector2(-0.5f, -0.5f),
				new Vector2(0.5f, -0.5f)
			};
			mesh.vertices = new Vector3[]
			{
				new Vector3(0.5f, 0.5f, 0f),
				new Vector3(-0.5f, 0.5f, 0f),
				new Vector3(-0.5f, -0.5f, 0f),
				new Vector3(0.5f, -0.5f, 0f)
			};
			mesh.SetIndices(new int[] { 0, 2, 1, 0, 3, 2 }, MeshTopology.Triangles, 0);
			mesh.uv = new Vector2[]
			{
				new Vector2(0.5f, 0.5f),
				new Vector2(-0.5f, 0.5f),
				new Vector2(-0.5f, -0.5f),
				new Vector2(0.5f, -0.5f)
			};
			mesh.uv2 = new Vector2[]
			{
				new Vector2(0.5f, 0.5f),
				new Vector2(-0.5f, 0.5f),
				new Vector2(-0.5f, -0.5f),
				new Vector2(0.5f, -0.5f)
			};
			mesh.colors = new Color[]
			{
				Color.white,
				Color.white,
				Color.white,
				Color.white
			};
			meshCache.mesh = mesh;
			FloorMesh.cache[this.cacheKey] = meshCache;
			return;
		}
		FloorMesh.polygons.Add(new List<Vector2>[]
		{
			FloorMesh.mainPolygon0,
			FloorMesh.mainPolygon1,
			FloorMesh.mainPolygon2,
			FloorMesh.mainPolygon3
		});
		list3.Add(new List<Vector2>[]
		{
			FloorMesh.cwShadowPolygon0,
			FloorMesh.cwShadowPolygon1,
			FloorMesh.ccwShadowPolygon0,
			FloorMesh.ccwShadowPolygon1
		});
		foreach (List<Vector2> list5 in FloorMesh.polygons)
		{
			for (int num = 0; num < list5.Count; num++)
			{
				list.Add(list5[num]);
				list2.Add(Color.white);
			}
		}
		foreach (List<Vector2> list6 in list3)
		{
			for (int num2 = 0; num2 < list6.Count; num2++)
			{
				list.Add(list6[num2]);
				list2.Add(Color.white);
			}
		}
		FloorMesh.meshIndices.Clear();
		if (FloorMesh.mainPolygon0Conn.Count > 0)
		{
			this.KnitTriangles(FloorMesh.mainPolygon0, FloorMesh.mainPolygon0Conn, FloorMesh.mainPolygon1.Count, 0, false);
		}
		if (FloorMesh.mainPolygon1Conn.Count > 0)
		{
			this.KnitTriangles(FloorMesh.mainPolygon1, FloorMesh.mainPolygon1Conn, FloorMesh.mainPolygon2.Count, FloorMesh.mainPolygon0.Count, false);
			if (this.pathOverlaps && !this.cornerRaysIntersectBeforeSpikes)
			{
				int num3 = FloorMesh.mainPolygon0.Count + FloorMesh.mainPolygon1.Count;
				int num4 = num3 - 1;
				int num5 = num3 + FloorMesh.mainPolygon2.Count - 1;
				FloorMesh.meshIndices.Add(new int[] { num4, num5, num3 });
				FloorMesh.meshIndices.Add(new int[]
				{
					num4,
					num3,
					FloorMesh.mainPolygon0.Count
				});
				FloorMesh.meshIndices.Add(new int[]
				{
					num4,
					num5 - 1,
					num5
				});
				FloorMesh.meshIndices.Add(new int[]
				{
					num4,
					num5 - 2,
					num5 - 1
				});
				FloorMesh.meshIndices.Add(new int[]
				{
					num4,
					num5 - 3,
					num5 - 2
				});
			}
		}
		if (FloorMesh.mainPolygon2Conn.Count > 0)
		{
			this.KnitTriangles(FloorMesh.mainPolygon2, FloorMesh.mainPolygon2Conn, FloorMesh.mainPolygon3.Count, FloorMesh.mainPolygon0.Count + FloorMesh.mainPolygon1.Count, false);
		}
		this.KnitTriangles(FloorMesh.cwShadowPolygon0, FloorMesh.cwShadowPolygonConn, FloorMesh.cwShadowPolygon1.Count, FloorMesh.mainPolygon0.Count + FloorMesh.mainPolygon1.Count + FloorMesh.mainPolygon2.Count + FloorMesh.mainPolygon3.Count, false);
		this.KnitTriangles(FloorMesh.ccwShadowPolygon0, FloorMesh.ccwShadowPolygonConn, FloorMesh.ccwShadowPolygon1.Count, FloorMesh.mainPolygon0.Count + FloorMesh.mainPolygon1.Count + FloorMesh.mainPolygon2.Count + FloorMesh.mainPolygon3.Count + FloorMesh.cwShadowPolygon0.Count + FloorMesh.cwShadowPolygon1.Count, false);
		mesh.vertices = list.ToArray();
		mesh.SetIndices(FloorMesh.meshIndices.ToArray(), MeshTopology.Triangles, 0);
		mesh.colors = list2.ToArray();
		List<float> list7 = new List<float> { 0f, this.insetDistance0, this.insetDistance1, this.insetDistance2, 0f };
		float num6 = 1f;
		int num7 = 0;
		foreach (List<Vector2> list8 in FloorMesh.polygons)
		{
			num6 -= list7[num7] / this.width;
			for (int num8 = 0; num8 < list8.Count; num8++)
			{
				FloorMesh.uvs.Add(new Vector2(0.5f, num6));
				Vector2 vector = list8[num8];
				FloorMesh.uvs2.Add(new Vector2(vector.x, vector.y));
			}
			num7++;
		}
		List<float> list9 = new List<float> { 2f, 1f, 2f, 1f };
		if (FloorMesh.diamondShadowOuterVertexDistance > 0f)
		{
			list9[2] = 2f - FloorMesh.diamondShadowOuterVertexDistance;
		}
		int num9 = 0;
		foreach (List<Vector2> list10 in list3)
		{
			num6 = list9[num9];
			for (int num10 = 0; num10 < list10.Count; num10++)
			{
				Vector2 vector2 = new Vector2(0.5f, num6);
				if (FloorMesh.diamondShadowOuterVertexDistance > 0f && num9 == 2 && (num10 == 0 || num10 == 2))
				{
					vector2 = new Vector2(0.5f, 1f);
				}
				FloorMesh.uvs.Add(vector2);
				Vector2 vector3 = list10[num10];
				FloorMesh.uvs2.Add(new Vector2(vector3.x, vector3.y));
			}
			num9++;
		}
		mesh.uv = FloorMesh.uvs.ToArray();
		mesh.uv2 = FloorMesh.uvs2.ToArray();
		meshCache.mesh = mesh;
		meshCache.polygon = FloorMesh.mainPolygon0.ToArray();
		FloorMesh.cache[this.cacheKey] = meshCache;
	}

	// Token: 0x06001602 RID: 5634 RVA: 0x000B6320 File Offset: 0x000B4520
	private void GetPositions(float angle0, float angle1, float width, float length, int curvaturePoints)
	{
		FloorMesh.<>c__DisplayClass103_0 CS$<>8__locals1;
		CS$<>8__locals1.<>4__this = this;
		angle0 = this.ModAngle360(angle0);
		angle1 = this.ModAngle360(angle1);
		if (this.ModAngle360(angle1 - angle0) >= 3.1415927f)
		{
			float num = angle0;
			angle0 = angle1;
			angle1 = num;
		}
		this.insetDistance0 = 0f;
		this.insetDistance1 = 0f;
		this.insetDistance2 = 0f;
		this.cornerCenterApothem = 0f;
		width = Mathf.Max(0f, width);
		length = Mathf.Max(length, width);
		curvaturePoints = Math.Max(curvaturePoints, 3);
		this.shortAngle = this.SmallestAngleBetweenTwoAngles(angle1, angle0);
		CS$<>8__locals1.zeroAngle = this.shortAngle < 0.0001f;
		CS$<>8__locals1.piAngle = Mathf.Abs(this.shortAngle - 3.1415927f) < 0.0001f;
		this.origin = Vector2.zero;
		if (Mathf.Abs(this.shortAngle - 0f) < 0.0001f)
		{
			this.origin = this.origin.Add(angle1, -(length * 0.3333333f) / 4f);
			length *= 0.6666667f;
		}
		Vector2 vector = this.origin.Add(angle0, length);
		float num2 = angle0 + 1.5707964f;
		CS$<>8__locals1.startMore = vector.Add(num2, width);
		float num3 = num2 + 1.5707964f;
		Vector2 vector2 = CS$<>8__locals1.startMore.Add(num3, width * 0.01f);
		float num4 = angle0 + -1.5707964f;
		CS$<>8__locals1.startLess = vector.Add(num4, width);
		float num5 = num4 + -1.5707964f;
		Vector2 vector3 = CS$<>8__locals1.startLess.Add(num5, width * 0.01f);
		Vector2 vector4 = this.origin.Add(angle1, length);
		float num6 = angle1 + 1.5707964f;
		CS$<>8__locals1.endMore = vector4.Add(num6, width);
		float num7 = num6 + 1.5707964f;
		Vector2 vector5 = CS$<>8__locals1.endMore.Add(num7, width * 0.01f);
		float num8 = angle1 + -1.5707964f;
		CS$<>8__locals1.endLess = vector4.Add(num8, width);
		float num9 = num8 + -1.5707964f;
		Vector2 vector6 = CS$<>8__locals1.endLess.Add(num9, width * 0.01f);
		CS$<>8__locals1.ccwIntersection = ((CS$<>8__locals1.zeroAngle | CS$<>8__locals1.piAngle) ? this.origin : this.GetLineIntersection(new Segment(CS$<>8__locals1.startMore, vector2), new Segment(CS$<>8__locals1.endLess, vector6)));
		CS$<>8__locals1.cwIntersection = ((CS$<>8__locals1.zeroAngle | CS$<>8__locals1.piAngle) ? this.origin : this.GetLineIntersection(new Segment(CS$<>8__locals1.startLess, vector3), new Segment(CS$<>8__locals1.endMore, vector5)));
		float num10 = 0f;
		if (this.shortAngle < 0.08726646f)
		{
			num10 = 1f;
		}
		else if (this.shortAngle < 0.5235988f)
		{
			float num11 = 0.43633235f;
			num10 = Mathf.Lerp(1f, 0.83f, Mathf.Pow((this.shortAngle - 0.08726646f) / num11, 0.5f));
		}
		else if (this.shortAngle < 0.7853982f)
		{
			float num12 = 0.2617994f;
			num10 = Mathf.Lerp(0.83f, 0.77f, Mathf.Pow((this.shortAngle - 0.5235988f) / num12, 1f));
		}
		else if (this.shortAngle < 1.5707964f)
		{
			float num13 = 0.7853982f;
			num10 = Mathf.Lerp(0.77f, 0.15f, Mathf.Pow((this.shortAngle - 0.7853982f) / num13, 0.7f));
		}
		else if (this.shortAngle < 2.0943952f)
		{
			float num14 = 0.5235988f;
			num10 = Mathf.Lerp(0.15f, 0f, Mathf.Pow((this.shortAngle - 1.5707964f) / num14, 0.5f));
		}
		if (num10 < 0.001f)
		{
			num10 = 0f;
		}
		if ((double)num10 < 0.001)
		{
			num10 = 0f;
		}
		this.angleDifference = this.ModAngle360(angle1 - angle0);
		Vector2 vector7 = Vector2.Lerp(CS$<>8__locals1.cwIntersection, this.origin, num10);
		Vector2 vector8 = Vector2.Lerp(CS$<>8__locals1.ccwIntersection, this.origin, num10);
		this.cornerCenterRadius = Mathf.Lerp(0f, width, num10);
		CS$<>8__locals1.cwCornerPoints = new List<Vector2>();
		CS$<>8__locals1.ccwCornerPoints = new List<Vector2>();
		if (this.angleDifference < 2.0942953f)
		{
			this.cornerCircleCenter = vector7;
			foreach (Vector2 vector9 in this.CreateCircleArc(vector7, this.ModAngle360(num6), this.ModAngle360(num4), this.cornerCenterRadius, curvaturePoints, out this.curvatureSliceAngle))
			{
				CS$<>8__locals1.cwCornerPoints.Add(vector9);
			}
		}
		else
		{
			CS$<>8__locals1.cwCornerPoints.Add(CS$<>8__locals1.cwIntersection);
		}
		if (this.angleDifference > 4.3634233f)
		{
			this.cornerCircleCenter = vector8;
			foreach (Vector2 vector10 in this.CreateCircleArc(vector8, this.ModAngle360(num2), this.ModAngle360(num8), this.cornerCenterRadius, curvaturePoints, out this.curvatureSliceAngle))
			{
				CS$<>8__locals1.ccwCornerPoints.Add(vector10);
			}
		}
		else
		{
			CS$<>8__locals1.ccwCornerPoints.Add(CS$<>8__locals1.ccwIntersection);
		}
		Vector2 vector11 = ((this.angleDifference < 3.1415927f) ? CS$<>8__locals1.ccwIntersection : CS$<>8__locals1.cwIntersection);
		CS$<>8__locals1.isPathOverlapping = Vector2.Distance(this.origin, CS$<>8__locals1.startMore) < Vector2.Distance(this.origin, vector11);
		CS$<>8__locals1.overlappingPoints = null;
		if (CS$<>8__locals1.isPathOverlapping)
		{
			CS$<>8__locals1.overlappingPoints = new Vector2[]
			{
				this.GetLineIntersection(new Segment(CS$<>8__locals1.startLess, CS$<>8__locals1.startMore), new Segment(CS$<>8__locals1.endLess, vector6)),
				this.GetLineIntersection(new Segment(CS$<>8__locals1.startLess, CS$<>8__locals1.startMore), new Segment(CS$<>8__locals1.endLess, CS$<>8__locals1.endMore)),
				this.GetLineIntersection(new Segment(CS$<>8__locals1.endLess, CS$<>8__locals1.endMore), new Segment(CS$<>8__locals1.startMore, vector2))
			};
		}
		FloorMesh.mainPolygon0.Clear();
		FloorMesh.mainPolygon0Conn.Clear();
		FloorMesh.mainPolygon1.Clear();
		FloorMesh.mainPolygon1Conn.Clear();
		FloorMesh.mainPolygon2.Clear();
		FloorMesh.mainPolygon2Conn.Clear();
		FloorMesh.mainPolygon3.Clear();
		FloorMesh.cwShadowPolygon0.Clear();
		FloorMesh.cwShadowPolygonConn.Clear();
		FloorMesh.ccwShadowPolygon0.Clear();
		FloorMesh.ccwShadowPolygonConn.Clear();
		FloorMesh.cwShadowPolygon1.Clear();
		FloorMesh.ccwShadowPolygon1.Clear();
		FloorMesh.diamondShadowOuterVertexDistance = 0f;
		this.cornerPointIndex = this.<GetPositions>g__GeneratePolygon|103_0(FloorMesh.mainPolygon0, true, ref CS$<>8__locals1);
		List<Vector2> list = FloorMesh.mainPolygon0;
		this.pathOverlaps = CS$<>8__locals1.isPathOverlapping && !CS$<>8__locals1.zeroAngle && !CS$<>8__locals1.piAngle;
		if (this.pathOverlaps)
		{
			Segment bisector = this.GetBisector(list[list.Count - 1], list[0], list[1]);
			Segment bisector2 = this.GetBisector(list[0], list[1], list[2]);
			this.cornerCenterApothem = this.cornerCenterRadius * Mathf.Cos(this.curvatureSliceAngle / 2f);
			this.bisectorIntersection = this.GetLineIntersection(bisector, bisector2);
			float num15 = this.Projection(new Segment(list[1], list[2]), this.bisectorIntersection);
			this.cornerRaysIntersectBeforeSpikes = this.cornerCenterApothem < num15;
			if (this.cornerRaysIntersectBeforeSpikes)
			{
				this.insetDistance0 = this.cornerCenterApothem;
				this.insetDistance1 = num15 - this.insetDistance0;
			}
			else
			{
				this.insetDistance0 = num15;
			}
		}
		else if (num10 > 0f)
		{
			this.insetDistance0 = this.cornerCenterRadius;
		}
		else
		{
			this.insetDistance0 = width;
		}
		bool flag = !CS$<>8__locals1.zeroAngle && !this.pathOverlaps;
		if (flag)
		{
			list = new List<Vector2>();
			this.<GetPositions>g__GeneratePolygon|103_0(list, false, ref CS$<>8__locals1);
		}
		if (!CS$<>8__locals1.zeroAngle)
		{
			FloorMesh.mainPolygon1 = this.<GetPositions>g__CreateInsetFromPolygon|103_1(list, this.insetDistance0, ref CS$<>8__locals1);
		}
		else
		{
			Vector2 vector12 = this.origin.Add(angle0, length - width);
			FloorMesh.mainPolygon1 = new List<Vector2> { vector12, this.origin };
			FloorMesh.mainPolygon0Conn.Add(0);
			for (int j = 0; j < curvaturePoints; j++)
			{
				FloorMesh.mainPolygon0Conn.Add(1);
			}
			FloorMesh.mainPolygon0Conn.Add(0);
		}
		if (!CS$<>8__locals1.zeroAngle)
		{
			if (flag && FloorMesh.mainPolygon1.Count != FloorMesh.mainPolygon0.Count)
			{
				int count = FloorMesh.mainPolygon0.Count;
				int count2 = FloorMesh.mainPolygon1.Count;
				for (int k = 0; k < FloorMesh.mainPolygon0.Count; k++)
				{
					if (k == this.cornerPointIndex)
					{
						for (int l = 0; l < curvaturePoints; l++)
						{
							FloorMesh.mainPolygon0Conn.Add(k);
						}
					}
					else
					{
						FloorMesh.mainPolygon0Conn.Add(k);
					}
				}
				this.insetDistance1 = width - this.insetDistance0;
				if (this.insetDistance1 > 0f)
				{
					FloorMesh.mainPolygon2 = this.<GetPositions>g__CreateInsetFromPolygon|103_1(FloorMesh.mainPolygon1, this.insetDistance1, ref CS$<>8__locals1);
					for (int m = 0; m < FloorMesh.mainPolygon2.Count; m++)
					{
						FloorMesh.mainPolygon1Conn.Add(m);
					}
				}
			}
			else
			{
				for (int n = 0; n < FloorMesh.mainPolygon0.Count; n++)
				{
					FloorMesh.mainPolygon0Conn.Add(n);
				}
			}
			if (this.pathOverlaps)
			{
				if (this.cornerRaysIntersectBeforeSpikes)
				{
					int num16 = 4;
					int num17 = curvaturePoints - 1;
					this.WeldConnectionsForVertices(FloorMesh.mainPolygon0, FloorMesh.mainPolygon0Conn, FloorMesh.mainPolygon1, num16, num17);
					FloorMesh.mainPolygon1[3] = this.cornerCircleCenter;
					FloorMesh.mainPolygon2 = this.<GetPositions>g__CreateInsetFromPolygon|103_1(FloorMesh.mainPolygon1, this.insetDistance1, ref CS$<>8__locals1);
					for (int num18 = 0; num18 < FloorMesh.mainPolygon2.Count; num18++)
					{
						FloorMesh.mainPolygon1Conn.Add(num18);
					}
					num16 = FloorMesh.mainPolygon1.Count - 2;
					num17 = 4;
					this.WeldConnectionsForVertices(FloorMesh.mainPolygon1, FloorMesh.mainPolygon1Conn, FloorMesh.mainPolygon2, num16, num17);
					this.insetDistance2 = width - this.insetDistance1 - this.insetDistance0;
					FloorMesh.mainPolygon2Conn.Add(new int[4]);
					FloorMesh.mainPolygon3.Add(this.origin);
				}
				else
				{
					int num19 = FloorMesh.mainPolygon0.Count - 2;
					this.WeldConnectionsForVertices(FloorMesh.mainPolygon0, FloorMesh.mainPolygon0Conn, FloorMesh.mainPolygon1, num19, 4);
					Vector2 vector13 = FloorMesh.mainPolygon1[FloorMesh.mainPolygon0Conn[this.cornerPointIndex]];
					Vector2 vector14 = FloorMesh.mainPolygon1[FloorMesh.mainPolygon0Conn[this.cornerPointIndex + 1]];
					float num20 = this.Projection(new Segment(vector13, vector14), this.cornerCircleCenter);
					this.insetDistance1 = this.cornerCenterApothem - this.insetDistance0;
					if (this.useFInset2)
					{
						this.insetDistance1 = num20;
					}
					FloorMesh.mainPolygon2 = this.<GetPositions>g__CreateInsetFromPolygon|103_1(FloorMesh.mainPolygon1, this.insetDistance1, ref CS$<>8__locals1);
					float num21 = length - this.insetDistance0 - this.insetDistance1;
					float num22 = width - this.insetDistance0 - this.insetDistance1;
					Vector2 vector15 = vector.normalized * num21;
					Vector2 vector16 = vector4.normalized * num21;
					Vector2 vector17 = vector15 + (CS$<>8__locals1.startMore - vector).normalized * num22;
					Vector2 vector18 = vector16 + (CS$<>8__locals1.endLess - vector4).normalized * num22;
					Vector2 vector19 = vector17 + (vector2 - CS$<>8__locals1.startMore).normalized * 0.01f;
					Vector2 vector20 = vector18 + (vector6 - CS$<>8__locals1.endLess).normalized * 0.01f;
					Vector2 lineIntersection = this.GetLineIntersection(new Segment(vector17, vector19), new Segment(vector18, vector20));
					FloorMesh.mainPolygon2.RemoveAt(FloorMesh.mainPolygon2.Count - 1);
					FloorMesh.mainPolygon2.Add(new Vector2[] { vector17, lineIntersection, vector18 });
					for (int num23 = 0; num23 < FloorMesh.mainPolygon2.Count; num23++)
					{
						FloorMesh.mainPolygon1Conn.Add(num23);
					}
					this.WeldConnectionsForVertices(FloorMesh.mainPolygon1, FloorMesh.mainPolygon1Conn, FloorMesh.mainPolygon2, 3, curvaturePoints - 3);
					FloorMesh.mainPolygon1Conn[FloorMesh.mainPolygon1Conn.Count - 1] = -1;
					FloorMesh.mainPolygon1Conn[FloorMesh.mainPolygon1Conn.Count - 2] = -1;
					FloorMesh.mainPolygon1Conn[FloorMesh.mainPolygon1Conn.Count - 3] = -1;
					num21 = length - width;
					vector15 = vector.normalized * num21;
					vector16 = vector4.normalized * num21;
					Vector2 vector21 = Vector2.Lerp(FloorMesh.mainPolygon2[2], FloorMesh.mainPolygon2[FloorMesh.mainPolygon2.Count - 2], 0.5f);
					FloorMesh.mainPolygon3.Add(new Vector2[] { vector16, vector21, vector15, vector21 });
					FloorMesh.mainPolygon2Conn.Add(new int[] { 0, 1, 1, 1, 2, 2, 3, 0 });
					this.insetDistance2 = width - this.insetDistance0 - this.insetDistance1;
				}
			}
		}
		if (CS$<>8__locals1.piAngle)
		{
			Vector2 vector22 = (CS$<>8__locals1.startMore - vector).normalized * 0.11f + CS$<>8__locals1.startMore;
			Vector2 vector23 = (CS$<>8__locals1.endLess - vector4).normalized * 0.11f + CS$<>8__locals1.endLess;
			FloorMesh.ccwShadowPolygon0.Add(new Vector2[] { vector22, vector23 });
			FloorMesh.ccwShadowPolygonConn.Add(new int[] { 0, 10001 });
			FloorMesh.ccwShadowPolygon1.Add(new Vector2[] { CS$<>8__locals1.startMore, CS$<>8__locals1.endLess });
			Vector2 vector24 = (CS$<>8__locals1.endMore - vector4).normalized * 0.11f + CS$<>8__locals1.endMore;
			Vector2 vector25 = (CS$<>8__locals1.startLess - vector).normalized * 0.11f + CS$<>8__locals1.startLess;
			FloorMesh.cwShadowPolygon0.Add(new Vector2[] { vector24, vector25 });
			FloorMesh.cwShadowPolygonConn.Add(new int[] { 0, 10001 });
			FloorMesh.cwShadowPolygon1.Add(new Vector2[] { CS$<>8__locals1.endMore, CS$<>8__locals1.startLess });
			return;
		}
		if (!this.pathOverlaps && !CS$<>8__locals1.zeroAngle)
		{
			Vector2 lineIntersection2 = this.GetLineIntersection(new Segment(vector4, CS$<>8__locals1.endLess), new Segment(vector, CS$<>8__locals1.startMore));
			if (Vector2.Distance(lineIntersection2, CS$<>8__locals1.endLess) < 0.11f)
			{
				FloorMesh.ccwShadowPolygon0.Add(new Vector2[] { CS$<>8__locals1.startMore, lineIntersection2, CS$<>8__locals1.endLess });
				FloorMesh.ccwShadowPolygonConn.Add(new int[2]);
				FloorMesh.ccwShadowPolygon1.Add(CS$<>8__locals1.ccwIntersection);
				FloorMesh.diamondShadowOuterVertexDistance = 1f - Vector2.Distance(CS$<>8__locals1.ccwIntersection, lineIntersection2) / 0.11f;
			}
			else
			{
				Vector2 vector26 = (CS$<>8__locals1.startMore - vector).normalized * 0.11f + CS$<>8__locals1.startMore;
				Vector2 vector27 = (CS$<>8__locals1.endLess - vector4).normalized * 0.11f + CS$<>8__locals1.endLess;
				Vector2 lineIntersection3 = this.GetLineIntersection(new Segment(vector26, vector26 + (vector2 - CS$<>8__locals1.startMore)), new Segment(vector27, vector27 + (vector6 - CS$<>8__locals1.endLess)));
				FloorMesh.ccwShadowPolygon0.Add(new Vector2[] { vector26, lineIntersection3, vector27 });
				FloorMesh.ccwShadowPolygonConn.Add(new int[] { 0, 1 });
				FloorMesh.ccwShadowPolygon1.Add(new Vector2[] { CS$<>8__locals1.startMore, CS$<>8__locals1.ccwIntersection, CS$<>8__locals1.endLess });
			}
		}
		Vector2 vector28 = (CS$<>8__locals1.endMore - vector4).normalized * 0.11f + CS$<>8__locals1.endMore;
		Vector2 vector29 = (CS$<>8__locals1.startLess - vector).normalized * 0.11f + CS$<>8__locals1.startLess;
		FloorMesh.cwShadowPolygon0.Add(vector28);
		FloorMesh.cwShadowPolygonConn.Add(0);
		bool flag2 = CS$<>8__locals1.cwCornerPoints.Count > 1;
		float num24 = (flag2 ? (0.11f + this.cornerCenterRadius) : 0.11f);
		Vector2[] array2 = this.CreateCircleArc(vector7, this.ModAngle360(num6), this.ModAngle360(num4), num24, curvaturePoints, out this.curvatureSliceAngle);
		int num25 = 1;
		foreach (Vector2 vector30 in array2)
		{
			FloorMesh.cwShadowPolygon0.Add(vector30);
			FloorMesh.cwShadowPolygonConn.Add(num25);
			if (flag2)
			{
				num25++;
			}
		}
		FloorMesh.cwShadowPolygon0.Add(vector29);
		FloorMesh.cwShadowPolygon1.Add(CS$<>8__locals1.endMore);
		for (int num26 = 0; num26 < CS$<>8__locals1.cwCornerPoints.Count; num26++)
		{
			FloorMesh.cwShadowPolygon1.Add(CS$<>8__locals1.cwCornerPoints[num26]);
		}
		FloorMesh.cwShadowPolygon1.Add(CS$<>8__locals1.startLess);
	}

	// Token: 0x06001603 RID: 5635 RVA: 0x000B758C File Offset: 0x000B578C
	private void PrintState()
	{
		int num = 0;
		string text = string.Format("conns (mainPolygon: {0}, conn: {1}):\n", FloorMesh.mainPolygon0.Count, FloorMesh.mainPolygon0Conn.Count);
		foreach (Vector2 vector in FloorMesh.mainPolygon0)
		{
			text += string.Format("p {0} -> {1}\n", num, FloorMesh.mainPolygon0Conn[num]);
			num++;
		}
		MonoBehaviour.print(text);
	}

	// Token: 0x06001604 RID: 5636 RVA: 0x000B7634 File Offset: 0x000B5834
	private void WeldConnectionsForVertices(List<Vector2> polygon, List<int> connections, List<Vector2> inset, int startIndex, int count)
	{
		for (int i = 0; i < count; i++)
		{
			int num = (startIndex + i) % polygon.Count;
			this.WeldWithPreviousVertexConnection(polygon, connections, inset, num);
		}
	}

	// Token: 0x06001605 RID: 5637 RVA: 0x000B7664 File Offset: 0x000B5864
	private void WeldWithPreviousVertexConnection(List<Vector2> polygon, List<int> connections, List<Vector2> inset, int polygonVertexIndex)
	{
		int num = ((polygonVertexIndex == 0) ? (polygon.Count - 1) : (polygonVertexIndex - 1));
		int num2 = connections[polygonVertexIndex];
		int num3 = connections[num];
		connections[polygonVertexIndex] = num3;
		inset.RemoveAt(num2);
		for (int i = 0; i < connections.Count; i++)
		{
			if (connections[i] >= num2)
			{
				int num4 = i;
				int num5 = connections[num4];
				connections[num4] = num5 - 1;
			}
		}
	}

	// Token: 0x06001606 RID: 5638 RVA: 0x0002B123 File Offset: 0x00029323
	private bool AnglesAreEqual(float a, float b)
	{
		return Mathf.Abs(a - b) < 0.0001f;
	}

	// Token: 0x06001607 RID: 5639 RVA: 0x0002B134 File Offset: 0x00029334
	private float Float(int x)
	{
		return (float)x;
	}

	// Token: 0x06001608 RID: 5640 RVA: 0x000B76DC File Offset: 0x000B58DC
	private List<T> MakeListByRepeatingMember<T>(T member, int count)
	{
		List<T> list = new List<T>();
		for (int i = 0; i < count; i++)
		{
			list.Add(member);
		}
		return list;
	}

	// Token: 0x06001609 RID: 5641 RVA: 0x000B7704 File Offset: 0x000B5904
	private Vector2[] CreateCircleArc(Vector2 center, float angleA, float angleB, float radius, int pointCount, out float sliceAngle)
	{
		if (angleA > angleB)
		{
			angleA -= 6.2831855f;
		}
		Vector2[] array = new Vector2[pointCount];
		for (int i = 0; i < pointCount; i++)
		{
			float num = this.Float(i) / (float)(pointCount - 1);
			float num2 = Mathf.Lerp(angleA, angleB, num);
			array[i] = center.Add(num2, radius);
		}
		sliceAngle = (angleB - angleA) / (float)(pointCount - 1);
		return array;
	}

	// Token: 0x0600160A RID: 5642 RVA: 0x000B7768 File Offset: 0x000B5968
	private float SmallestAngleBetweenTwoAngles(float angleA, float angleB)
	{
		float num = this.Mod(angleB - angleA, 6.2831855f);
		float num2 = this.Mod(angleA - angleB, 6.2831855f);
		return Math.Min(num, num2);
	}

	// Token: 0x0600160B RID: 5643 RVA: 0x0002B138 File Offset: 0x00029338
	private float Mod(float a, float b)
	{
		return (a % b + b) % b;
	}

	// Token: 0x0600160C RID: 5644 RVA: 0x0002B138 File Offset: 0x00029338
	private int Mod(int a, int b)
	{
		return (a % b + b) % b;
	}

	// Token: 0x0600160D RID: 5645 RVA: 0x0002B141 File Offset: 0x00029341
	private float ModAngle360(float a)
	{
		return this.Mod(a, 6.2831855f);
	}

	// Token: 0x0600160E RID: 5646 RVA: 0x000B7798 File Offset: 0x000B5998
	private static bool LinesIntersect(Vector2 a, Vector2 b, Vector2 c, Vector2 d)
	{
		Vector2 vector = new Vector2(c.x - a.x, c.y - a.y);
		Vector2 vector2 = new Vector2(b.x - a.x, b.y - a.y);
		Vector2 vector3 = new Vector2(d.x - c.x, d.y - c.y);
		float num = vector.x * vector2.y - vector.y * vector2.x;
		float num2 = vector.x * vector3.y - vector.y * vector3.x;
		float num3 = vector2.x * vector3.y - vector2.y * vector3.x;
		if (num == 0f)
		{
			return c.x - a.x < 0f != c.x - b.x < 0f || c.y - a.y < 0f != c.y - b.y < 0f;
		}
		if (num3 == 0f)
		{
			return false;
		}
		float num4 = 1f / num3;
		float num5 = num2 * num4;
		float num6 = num * num4;
		return num5 >= 0f && num5 <= 1f && num6 >= 0f && num6 <= 1f;
	}

	// Token: 0x0600160F RID: 5647 RVA: 0x000B790C File Offset: 0x000B5B0C
	private Vector2 GetLineIntersection(Segment a, Segment b)
	{
		Vector2 vector = new Vector2(a.start.x - a.end.x, b.start.x - b.end.x);
		Vector2 vector2 = new Vector2(a.start.y - a.end.y, b.start.y - b.end.y);
		float num = this.Determinant(vector, vector2);
		Vector2 vector3 = new Vector2(this.Determinant(a.start, a.end), this.Determinant(b.start, b.end));
		return new Vector2(this.Determinant(vector3, vector) / num, this.Determinant(vector3, vector2) / num);
	}

	// Token: 0x06001610 RID: 5648 RVA: 0x0002B14F File Offset: 0x0002934F
	private bool ccw(Vector2 A, Vector2 B, Vector2 C)
	{
		return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
	}

	// Token: 0x06001611 RID: 5649 RVA: 0x0002B189 File Offset: 0x00029389
	private bool GetSegmentIntersect(Vector2 A, Vector2 B, Vector2 C, Vector2 D)
	{
		return this.ccw(A, C, D) != this.ccw(B, C, D) && this.ccw(A, B, C) != this.ccw(A, B, D);
	}

	// Token: 0x06001612 RID: 5650 RVA: 0x000B79D0 File Offset: 0x000B5BD0
	private Vector2[] QuadraticBezierCurve(Vector2 a, Vector2 b, Vector2 c, int pointCount)
	{
		Vector2[] array = new Vector2[pointCount];
		int num = pointCount - 1;
		for (int i = 0; i < pointCount; i++)
		{
			float num2 = this.Float(i) / (float)num;
			array[i] = this.QuadraticBezierPoint(a, b, c, num2);
		}
		return array;
	}

	// Token: 0x06001613 RID: 5651 RVA: 0x000B7A14 File Offset: 0x000B5C14
	private Vector2 QuadraticBezierPoint(Vector2 a, Vector2 b, Vector2 c, float t)
	{
		float num = (1f - t) * (1f - t) * a.x + 2f * (1f - t) * t * b.x + t * t * c.x;
		float num2 = (1f - t) * (1f - t) * a.y + 2f * (1f - t) * t * b.y + t * t * c.y;
		return new Vector2(num, num2);
	}

	// Token: 0x06001614 RID: 5652 RVA: 0x0002B1BB File Offset: 0x000293BB
	private float Determinant(Vector2 a, Vector2 b)
	{
		return a.x * b.y - a.y * b.x;
	}

	// Token: 0x06001615 RID: 5653 RVA: 0x000B7AA4 File Offset: 0x000B5CA4
	private Vector2 GenerateNormal(Segment s, float distance)
	{
		Vector2 vector = s.end - s.start;
		float x = vector.x;
		float y = vector.y;
		vector.x = -y;
		vector.y = x;
		vector.Normalize();
		vector.x *= distance;
		vector.y *= distance;
		return vector;
	}

	// Token: 0x06001616 RID: 5654 RVA: 0x000B7B04 File Offset: 0x000B5D04
	private float Projection(Segment s, Vector2 p)
	{
		Vector2 vector = p - s.start;
		Vector2 normalized = (s.end - s.start).normalized;
		float num = Vector2.Dot(vector, normalized);
		return Mathf.Sqrt(vector.magnitude * vector.magnitude - num * num);
	}

	// Token: 0x06001617 RID: 5655 RVA: 0x000B7B58 File Offset: 0x000B5D58
	private Segment GetBisector(Vector2 a, Vector2 b, Vector2 c)
	{
		Vector2 vector = a - b;
		Vector2 vector2 = c - b;
		vector2.Normalize();
		vector.Normalize();
		float num = Mathf.Atan2(vector2.y, vector2.x);
		if (num < 0f)
		{
			num += 6.2831855f;
		}
		float num2 = Mathf.Atan2(vector.y, vector.x);
		if (num2 < 0f)
		{
			num2 += 6.2831855f;
		}
		float num3 = num - num2;
		float num4 = (((num3 > 0f && num3 < 3.1415927f) || num3 < -3.1415927f) ? 1f : (-1f));
		Vector2 vector3 = ((vector + vector2) / 2f).normalized * num4;
		Color color = ((num4 > 0f) ? Color.green : Color.green);
		return new Segment(b, b + vector3 * 0.1f, color);
	}

	// Token: 0x06001618 RID: 5656 RVA: 0x000B7C4C File Offset: 0x000B5E4C
	private float Atan2ToAngle(float y, float x)
	{
		float num = Mathf.Atan2(y, x);
		num = ((num > 0f) ? num : (6.2831855f + num));
		num /= 6.2831855f;
		return 1f - Mathf.Abs(2f * num - 1f);
	}

	// Token: 0x0600161B RID: 5659 RVA: 0x000B7E28 File Offset: 0x000B6028
	[CompilerGenerated]
	internal static Vector2 <GenerateMesh>g__GenerateNthVertex|102_0(int i, float length)
	{
		float num = 1.5707964f + 1.0471976f * (float)i;
		return new Vector2(Mathf.Cos(num) * length, Mathf.Sin(num) * length);
	}

	// Token: 0x0600161C RID: 5660 RVA: 0x000B7E5C File Offset: 0x000B605C
	[CompilerGenerated]
	private int <GetPositions>g__GeneratePolygon|103_0(List<Vector2> v, bool roundCorners, ref FloorMesh.<>c__DisplayClass103_0 A_3)
	{
		List<Vector2> list;
		if (!roundCorners)
		{
			(list = new List<Vector2>()).Add(A_3.ccwIntersection);
		}
		else
		{
			list = A_3.ccwCornerPoints;
		}
		List<Vector2> list2 = list;
		List<Vector2> list3;
		if (!roundCorners)
		{
			(list3 = new List<Vector2>()).Add(A_3.cwIntersection);
		}
		else
		{
			list3 = A_3.cwCornerPoints;
		}
		List<Vector2> list4 = list3;
		int num = 0;
		if (A_3.zeroAngle)
		{
			v.Add(A_3.startMore);
			v.AddRange(list4);
			v.Add(A_3.endLess);
		}
		else if (A_3.piAngle)
		{
			v.Add(new Vector2[] { A_3.startMore, A_3.endLess, A_3.endMore, A_3.startLess });
		}
		else if (!A_3.isPathOverlapping)
		{
			v.Add(A_3.startMore);
			bool flag = list2.Count > list4.Count;
			if (flag)
			{
				num = v.Count;
			}
			v.AddRange(list2);
			v.Add(new Vector2[] { A_3.endLess, A_3.endMore });
			if (!flag)
			{
				num = v.Count;
			}
			v.AddRange(list4);
			v.Add(A_3.startLess);
		}
		else
		{
			v.Add(new Vector2[]
			{
				A_3.startMore,
				A_3.overlappingPoints[2],
				A_3.endMore
			});
			num = v.Count;
			v.AddRange(list4);
			v.Add(new Vector2[]
			{
				A_3.startLess,
				A_3.overlappingPoints[0],
				A_3.endLess,
				A_3.overlappingPoints[1]
			});
		}
		return num;
	}

	// Token: 0x0600161D RID: 5661 RVA: 0x000B8030 File Offset: 0x000B6230
	[CompilerGenerated]
	private List<Vector2> <GetPositions>g__CreateInsetFromPolygon|103_1(List<Vector2> polygon, float distance, ref FloorMesh.<>c__DisplayClass103_0 A_3)
	{
		List<Vector2> list = new List<Vector2>();
		Segment[] array = new Segment[polygon.Count];
		for (int i = 0; i < polygon.Count; i++)
		{
			Vector2 vector = polygon[i];
			int num = (i + 1) % polygon.Count;
			Vector2 vector2 = polygon[num];
			Segment segment = new Segment(vector, vector2);
			Vector2 vector3 = this.GenerateNormal(segment, distance);
			Vector2 vector4 = new Vector2((vector.x + vector2.x) / 2f, (vector.y + vector2.y) / 2f);
			new Segment(vector4, vector4 + vector3, Color.gray);
			Segment segment2 = new Segment(vector + vector3, vector2 + vector3, FloorMesh.darkGray);
			array[i] = segment2;
		}
		for (int j = 0; j < array.Length; j++)
		{
			int num2 = this.Mod(j - 1, array.Length);
			int num3 = this.Mod(j, array.Length);
			Segment segment3 = array[num2];
			Segment segment4 = array[num3];
			Vector2 lineIntersection = this.GetLineIntersection(segment3, segment4);
			list.Add(lineIntersection);
		}
		return list;
	}

	// Token: 0x04001B66 RID: 7014
	private const float angle5 = 0.08726646f;

	// Token: 0x04001B67 RID: 7015
	private const float angle30 = 0.5235988f;

	// Token: 0x04001B68 RID: 7016
	private const float angle45 = 0.7853982f;

	// Token: 0x04001B69 RID: 7017
	private const float angle90 = 1.5707964f;

	// Token: 0x04001B6A RID: 7018
	private const float angle120 = 2.0943952f;

	// Token: 0x04001B6B RID: 7019
	private const float angle180 = 3.1415927f;

	// Token: 0x04001B6C RID: 7020
	private const float angle250 = 4.363323f;

	// Token: 0x04001B6D RID: 7021
	private const float angle270 = 4.712389f;

	// Token: 0x04001B6E RID: 7022
	private const float angle360 = 6.2831855f;

	// Token: 0x04001B6F RID: 7023
	private const float leftTurn = 1.5707964f;

	// Token: 0x04001B70 RID: 7024
	private const float rightTurn = -1.5707964f;

	// Token: 0x04001B71 RID: 7025
	private const float angleEpsilon = 0.0001f;

	// Token: 0x04001B72 RID: 7026
	private const float rayEpsilon = 0.01f;

	// Token: 0x04001B73 RID: 7027
	private const int knittingLevel = 2147483647;

	// Token: 0x04001B74 RID: 7028
	private const float shadowWidth = 0.11f;

	// Token: 0x04001B75 RID: 7029
	private const float uTurnOffset = 0.6666667f;

	// Token: 0x04001B76 RID: 7030
	private const float defaultCurvaturePoints = 40f;

	// Token: 0x04001B77 RID: 7031
	private static readonly Color darkMagenta = new Color(0.8f, 0f, 0.8f, 1f);

	// Token: 0x04001B78 RID: 7032
	private static readonly Color darkCyan = new Color(0f, 0.6f, 0.6f, 1f);

	// Token: 0x04001B79 RID: 7033
	private static readonly Color darkGreen = new Color(0f, 0.7f, 0f, 1f);

	// Token: 0x04001B7A RID: 7034
	private static readonly Color darkGray = new Color(0.2f, 0.2f, 0.2f, 1f);

	// Token: 0x04001B7B RID: 7035
	private static readonly Color orange = new Color(1f, 0.5f, 0f, 1f);

	// Token: 0x04001B7C RID: 7036
	private static readonly Color lightBlue = new Color(0.3f, 0.6f, 1f, 1f);

	// Token: 0x04001B7D RID: 7037
	public static HashSet<FloorMesh> floorMeshesThatNeedUpdate = new HashSet<FloorMesh>();

	// Token: 0x04001B7E RID: 7038
	public static Dictionary<string, FloorMesh.MeshCache> cache = new Dictionary<string, FloorMesh.MeshCache>();

	// Token: 0x04001B7F RID: 7039
	private static List<List<Vector2>> polygons = new List<List<Vector2>>();

	// Token: 0x04001B80 RID: 7040
	private static List<List<int>> connections = new List<List<int>>();

	// Token: 0x04001B81 RID: 7041
	private static List<Vector2> mainPolygon0 = new List<Vector2>();

	// Token: 0x04001B82 RID: 7042
	private static List<int> mainPolygon0Conn = new List<int>();

	// Token: 0x04001B83 RID: 7043
	private static List<Vector2> mainPolygon1 = new List<Vector2>();

	// Token: 0x04001B84 RID: 7044
	private static List<int> mainPolygon1Conn = new List<int>();

	// Token: 0x04001B85 RID: 7045
	private static List<Vector2> mainPolygon2 = new List<Vector2>();

	// Token: 0x04001B86 RID: 7046
	private static List<int> mainPolygon2Conn = new List<int>();

	// Token: 0x04001B87 RID: 7047
	private static List<Vector2> mainPolygon3 = new List<Vector2>();

	// Token: 0x04001B88 RID: 7048
	private static List<Vector2> cwShadowPolygon0 = new List<Vector2>();

	// Token: 0x04001B89 RID: 7049
	private static List<int> cwShadowPolygonConn = new List<int>();

	// Token: 0x04001B8A RID: 7050
	private static List<Vector2> cwShadowPolygon1 = new List<Vector2>();

	// Token: 0x04001B8B RID: 7051
	private static List<Vector2> ccwShadowPolygon0 = new List<Vector2>();

	// Token: 0x04001B8C RID: 7052
	private static List<int> ccwShadowPolygonConn = new List<int>();

	// Token: 0x04001B8D RID: 7053
	private static List<Vector2> ccwShadowPolygon1 = new List<Vector2>();

	// Token: 0x04001B8E RID: 7054
	private static float diamondShadowOuterVertexDistance = 0f;

	// Token: 0x04001B8F RID: 7055
	private static List<Vector2> uvs = new List<Vector2>();

	// Token: 0x04001B90 RID: 7056
	private static List<Vector2> uvs2 = new List<Vector2>();

	// Token: 0x04001B91 RID: 7057
	private static List<int> meshIndices = new List<int>();

	// Token: 0x04001B92 RID: 7058
	[SerializeField]
	private float angle0;

	// Token: 0x04001B93 RID: 7059
	[SerializeField]
	private float angle1;

	// Token: 0x04001B94 RID: 7060
	[SerializeField]
	private float width;

	// Token: 0x04001B95 RID: 7061
	[SerializeField]
	private float length;

	// Token: 0x04001B96 RID: 7062
	[SerializeField]
	private int curvaturePoints;

	// Token: 0x04001B97 RID: 7063
	[SerializeField]
	private bool isSprite;

	// Token: 0x04001B98 RID: 7064
	[SerializeField]
	private bool isHexagon;

	// Token: 0x04001B99 RID: 7065
	[SerializeField]
	private bool useFInset2;

	// Token: 0x04001B9A RID: 7066
	[NonSerialized]
	public string cacheKey;

	// Token: 0x04001B9B RID: 7067
	public PolygonCollider2D polygonCollider;

	// Token: 0x04001B9C RID: 7068
	private MeshFilter meshFilter;

	// Token: 0x04001B9D RID: 7069
	private MeshRenderer meshRenderer;

	// Token: 0x04001B9E RID: 7070
	private float shortAngle;

	// Token: 0x04001B9F RID: 7071
	private float cornerCenterRadius;

	// Token: 0x04001BA0 RID: 7072
	private float cornerCenterApothem;

	// Token: 0x04001BA1 RID: 7073
	private float curvatureSliceAngle;

	// Token: 0x04001BA2 RID: 7074
	private float angleDifference;

	// Token: 0x04001BA3 RID: 7075
	private float insetDistance0;

	// Token: 0x04001BA4 RID: 7076
	private float insetDistance1;

	// Token: 0x04001BA5 RID: 7077
	private float insetDistance2;

	// Token: 0x04001BA6 RID: 7078
	private int cornerPointIndex;

	// Token: 0x04001BA7 RID: 7079
	private bool pathOverlaps;

	// Token: 0x04001BA8 RID: 7080
	private bool cornerRaysIntersectBeforeSpikes;

	// Token: 0x04001BA9 RID: 7081
	private Vector2 origin;

	// Token: 0x04001BAA RID: 7082
	private Vector2 bisectorIntersection;

	// Token: 0x04001BAB RID: 7083
	private Vector2 cornerCircleCenter;

	// Token: 0x02000389 RID: 905
	public class MeshCache
	{
		// Token: 0x04001BAC RID: 7084
		public Mesh mesh;

		// Token: 0x04001BAD RID: 7085
		public Vector2[] polygon;
	}
}
