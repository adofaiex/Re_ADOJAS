using System;
using Unity.VisualScripting;
using UnityEngine;
using System.Collections.Generic;

public class Game : MonoBehaviour
{
    // Start is called once before the first execution of Update after the MonoBehaviour is created

    public Material TileMaterial;
    public Material TileCircleMaterial;
    public Material TileShadowMaterial;
	public Material WhiteMaterial;
    private float angle = 100f;
    private GameObject tile;
    MaterialPropertyBlock materialPropertyBlock;
    public Camera camera;
    void Start()
    {/*
	    tile = new GameObject();
	    tile.AddComponent<MeshRenderer>();
	    tile.AddComponent<MeshFilter>();
	    tile.transform.position = Vector3.zero;
	    tile.transform.localScale = 4 * Vector3.one;
	    tile.GetComponent<MeshRenderer>().sharedMaterials = new[] { TileMaterial, TileCircleMaterial, TileShadowMaterial };
	    float cosangle1;
	    float cosangle2;
	    float sinangle1;
	    float sinangle2;
	    float unit;
	    (unit,cosangle1,sinangle1,cosangle2,sinangle2)=CreateTileMesh(0f, angle, false, tile.GetComponent<MeshFilter>().mesh);
	    materialPropertyBlock = new MaterialPropertyBlock();
	    tile.GetComponent<MeshRenderer>().GetPropertyBlock(materialPropertyBlock);
	    materialPropertyBlock.SetFloat("_Unit", unit);
	    materialPropertyBlock.SetFloat("_CosAngle1", cosangle1);
	    materialPropertyBlock.SetFloat("_CosAngle2", cosangle2);
	    materialPropertyBlock.SetFloat("_SinAngle1", sinangle1);
	    materialPropertyBlock.SetFloat("_SinAngle2", sinangle2);
	    tile.GetComponent<MeshRenderer>().SetPropertyBlock(materialPropertyBlock);*/
	    /*
	    for(int i=0;i<50000;i++)
	    {
		    tile = new GameObject();
		    tile.AddComponent<MeshRenderer>();
		    tile.AddComponent<MeshFilter>();
		    tile.GetComponent<MeshRenderer>().sharedMaterial = WhiteMaterial;
		    tile.GetComponent<MeshFilter>().mesh = CreateCircle(1,10);
		    tile.transform.position=new Vector3(i/10000f+100000f,0,0);
	    }*/

    }

    // Update is called once per frame
    void Update()
    {/*
	    if (Input.GetKey(KeyCode.LeftArrow))
	    { 
		    angle += 0.25f;
		    float cosangle1;
		    float cosangle2;
		    float sinangle1;
		    float sinangle2;
		    float unit;
		    tile.GetComponent<MeshFilter>().mesh = new Mesh();
		    (unit,cosangle1,sinangle1,cosangle2,sinangle2)=CreateTileMesh(0f, angle, true, tile.GetComponent<MeshFilter>().mesh);
		    tile.GetComponent<MeshRenderer>().GetPropertyBlock(materialPropertyBlock);
		    materialPropertyBlock.SetFloat("_Unit", unit);
		    materialPropertyBlock.SetFloat("_CosAngle1", cosangle1);
		    materialPropertyBlock.SetFloat("_CosAngle2", cosangle2);
		    materialPropertyBlock.SetFloat("_SinAngle1", sinangle1);
		    materialPropertyBlock.SetFloat("_SinAngle2", sinangle2);
		    tile.GetComponent<MeshRenderer>().SetPropertyBlock(materialPropertyBlock);
		    
	    }

	    if (Input.GetKey(KeyCode.RightArrow))
	    { 
		    angle -= 0.25f;
		    float cosangle1;
		    float cosangle2;
		    float sinangle1;
		    float sinangle2;
		    float unit;
		    tile.GetComponent<MeshFilter>().mesh = new Mesh();
		    (unit,cosangle1,sinangle1,cosangle2,sinangle2)=CreateTileMesh(0f, angle, false, tile.GetComponent<MeshFilter>().mesh);
		    tile.GetComponent<MeshRenderer>().GetPropertyBlock(materialPropertyBlock);
		    materialPropertyBlock.SetFloat("_Unit", unit);
		    materialPropertyBlock.SetFloat("_CosAngle1", cosangle1);
		    materialPropertyBlock.SetFloat("_CosAngle2", cosangle2);
		    materialPropertyBlock.SetFloat("_SinAngle1", sinangle1);
		    materialPropertyBlock.SetFloat("_SinAngle2", sinangle2);
		    tile.GetComponent<MeshRenderer>().SetPropertyBlock(materialPropertyBlock);
	    }*/
	    
	    var mesh = CreateCircle(1,10);
	    for(int i=0;i<50000;i++)
			Graphics.DrawMesh(mesh,new Vector3(i/10000f+10000f,0,0),Quaternion.identity, WhiteMaterial,0,camera,0);
    }
    public static float fmod(float a, float b){
        
	    return (a >= 0) ? (a % b) : (a % b + b);
    }

    public static float DistanceFromPointToLine(Vector3 P, Vector3 A, Vector3 B)
    {
	    Vector3 AP = P - A;
	    Vector3 AB = B - A;
	    float cross = AP.x * AB.y - AP.y * AB.x;
	    return Mathf.Abs(cross) / AB.magnitude;
    }
    private static (float,float,float,float,float) CreateTileMesh(float a1, float a2, bool isMidSpin, Mesh mesh, float iconAngle = 0, bool iconIsTurned = false)
    {
	    mesh.indexFormat = UnityEngine.Rendering.IndexFormat.UInt16;
	    //Color aaa = new Color(0.25f, 0.25f, 0.25f);
	    if (isMidSpin) a2 = a1;
	    const float _width = 0.275f;
	    const float _length = 0.5f;
	    float width = _width;
	    float length = _length;
	    float shadowWidth = 0.05f;
	    mesh.subMeshCount = 3;
	    //float m11 = Mathf.Cos(a1 / 180f * Mathf.PI);
	    //float m12 = Mathf.Sin(a1 / 180f * Mathf.PI);
	    //float m21 = Mathf.Cos(a2 / 180f * Mathf.PI);
	    //float m22 = Mathf.Sin(a2 / 180f * Mathf.PI);

	    List<Vector3> vertices = new List<Vector3>();
	    List<ushort> triangles= new List<ushort>(); 
	    List<ushort> triangles2 = new List<ushort>();
	    List<ushort> triangles3 = new List<ushort>();
	    List<Vector2> uvs = new List<Vector2>();


	    float[] a = new float[2];

	    if (Game.fmod(a1 - a2, 360f) >= Game.fmod(a2 - a1, 360f))
	    {
		    a[0] = Game.fmod(a1, 360f) * Mathf.PI / 180f;
		    a[1] = a[0] + Game.fmod(a2 - a1, 360f) * Mathf.PI / 180f;
	    }
	    else
	    {
		    a[0] = Game.fmod(a2, 360f) * Mathf.PI / 180f;
		    a[1] = a[0] + Game.fmod(a1 - a2, 360f) * Mathf.PI / 180f;
	    }

	    float angle = a[1] - a[0];
	    float mid = a[0] + angle / 2f;
	    
	    float n11 = Mathf.Cos(a[0]);
	    float n12 = Mathf.Sin(a[0]);
	    float n21 = Mathf.Cos(a[1]);
	    float n22 = Mathf.Sin(a[1]);
	    
	    

	    float x;
	    if (angle < 0.08726646f)
	    {
		    x = 1f;
	    }
	    else if (angle < 0.5235988f)
	    {
		    x = Mathf.Lerp(1f, 0.83f, Mathf.Pow((angle - 0.08726646f) / 0.43633235f, 0.5f));
	    }
	    else if (angle < 0.7853982f)
	    {
		    x = Mathf.Lerp(0.83f, 0.77f, Mathf.Pow((angle - 0.5235988f) / 0.2617994f, 1f));
	    }
	    else if (angle < 1.5707964f)
	    {
		    x = Mathf.Lerp(0.77f, 0.15f, Mathf.Pow((angle - 0.7853982f) / 0.7853982f, 0.7f));
	    }
	    else
	    {
		    x = Mathf.Lerp(0.15f, 0f, Mathf.Pow((angle - 1.5707964f) / 0.5235988f, 0.5f));
	    }



	    float distance;
	    float radius;
	    if (x == 1f)
	    {
		    distance = 0f;
		    radius = width;
	    }
	    else
	    {
		    radius = Mathf.Lerp(0f, width, x);
		    distance = (width - radius) / Mathf.Sin(angle / 2f);

	    }

	    if (angle == 0f || isMidSpin)
	    {
		    distance = 0.04140625f;
		    length = 0.291640625f;
	    }

	    float circlex = -distance * Mathf.Cos(mid);
	    float circley = -distance * Mathf.Sin(mid);
	    bool hascircle = angle < 2.0943952f;
	    if (isMidSpin)
	    {
		    vertices.Add(new Vector3(circlex,circley));
		    vertices.Add((length - width) * new Vector3(n11, n12, 0));
		    vertices.Add(new Vector3(width * n22 + length * n21, -width * n21 + length * n22));
		    vertices.Add(new Vector3(-width * n12 + length * n11, width * n11 + length * n12));
		    vertices.Add(new Vector3(radius * n12 + circlex, -radius * n11 + circley));
		    vertices.Add(new Vector3(-radius * n22 + circlex, radius * n21 + circley));
		    vertices.Add(new Vector3(-radius * n11 + circlex, -radius * n12 + circley));
		    vertices.Add(new Vector3((width+shadowWidth) * n12 + length * n11, -(width+shadowWidth) * n11 + length * n12));
		    vertices.Add(new Vector3(-(width+shadowWidth) * n22 + length * n21, (width+shadowWidth) * n21 + length * n22));
		    vertices.Add(new Vector3((radius+shadowWidth) * n12 + circlex, -(radius+shadowWidth) * n11 + circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) * n22 + circlex, (radius+shadowWidth) * n21 + circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) * n11 + circlex, -(radius+shadowWidth) * n12 + circley));
		    

		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    //uvs.Add(new Vector2(0, radius));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    /*
		    triangles.AddRange(new ushort[] { 0, 1, 3 });
		    triangles.AddRange(new ushort[] { 0, 2, 3 });
		    triangles.AddRange(new ushort[] { 1, 3, 7 });
		    triangles.AddRange(new ushort[] { 2, 3, 8 });
		    triangles.AddRange(new ushort[] { 3, 5, 7 });
		    triangles.AddRange(new ushort[] { 3, 6, 8 });
		    triangles.AddRange(new ushort[] { 3, 4, 5 });
		    triangles.AddRange(new ushort[] { 3, 4, 6 });
		    triangles.AddRange(new ushort[] { 1, 7, 9 });
		    triangles.AddRange(new ushort[] { 2, 8, 10 });
		    triangles.AddRange(new ushort[] { 1, 9, 11 });
		    triangles.AddRange(new ushort[] { 2, 10, 12 });
		    triangles.AddRange(new ushort[] { 1, 11, 0 });
		    triangles.AddRange(new ushort[] { 2, 12, 0 });*/
		    triangles.AddRange(new ushort[] { 1, 2, 3 });
		    triangles.AddRange(new ushort[] { 1, 2, 4 });
		    triangles.AddRange(new ushort[] { 1, 3, 5 });
		    triangles.AddRange(new ushort[] { 0, 1, 4 });
		    triangles.AddRange(new ushort[] { 0, 1, 5 });
		    triangles.AddRange(new ushort[] { 0, 4, 6 });
		    triangles.AddRange(new ushort[] { 0, 5, 6 });
		    
		    triangles3.AddRange(new ushort[] { 2, 4, 7 });
		    triangles3.AddRange(new ushort[] { 3, 5, 8 });
		    triangles3.AddRange(new ushort[] { 9, 4, 7 });
		    triangles3.AddRange(new ushort[] { 10, 5, 8 });
		    triangles3.AddRange(new ushort[] { 4, 6, 9 });
		    triangles3.AddRange(new ushort[] { 5, 6, 10 });
		    triangles3.AddRange(new ushort[] { 11, 6, 9 });
		    triangles3.AddRange(new ushort[] { 11, 6, 10 });
	    }
	    else if (angle >= 2.0943952f)
	    {
		    vertices.Add(Vector3.zero);
		    vertices.Add((length - width) * new Vector3(n11, n12, 0));
		    vertices.Add((length - width) * new Vector3(n21, n22, 0));
		    vertices.Add(width / Mathf.Sin(angle / 2) * CreateVector3WithRadius(mid));
		    vertices.Add(new Vector3(-width * n12 + length * n11, width * n11 + length * n12));
		    vertices.Add(new Vector3(width * n22 + length * n21, -width * n21 + length * n22));
		    vertices.Add(new Vector3(width * n12 + length * n11, -width * n11 + length * n12));
		    vertices.Add(new Vector3(-width * n22 + length * n21, width * n21 + length * n22));
		    vertices.Add(new Vector3(circlex, circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) + circlex, -(radius+shadowWidth) + circley));
		    vertices.Add(new Vector3((radius+shadowWidth) + circlex, -(radius+shadowWidth) + circley));
		    vertices.Add(new Vector3((radius+shadowWidth) + circlex, (radius+shadowWidth) + circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) + circlex, (radius+shadowWidth) + circley));
		    vertices.Add((width+shadowWidth) / Mathf.Sin(angle / 2) * CreateVector3WithRadius(mid));
		    vertices.Add(new Vector3(-(width+shadowWidth) * n12 + length * n11, (width+shadowWidth) * n11 + length * n12));
		    vertices.Add(new Vector3((width + shadowWidth) * n22 + length * n21, -(width + shadowWidth) * n21 + length * n22));
		    vertices.Add(new Vector3((width+shadowWidth) * n12 + length * n11, -(width+shadowWidth) * n11 + length * n12));
		    vertices.Add(new Vector3(-(width+shadowWidth) * n22 + length * n21, (width+shadowWidth) * n21 + length * n22));
		    vertices.Add(new Vector3((radius+shadowWidth) * n12 + circlex, -(radius+shadowWidth) * n11 + circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) * n22 + circlex, (radius+shadowWidth) * n21 + circley));
		    
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(1, 0));
		    uvs.Add(new Vector2(1, 1));
		    uvs.Add(new Vector2(0, 1));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    
		    triangles.AddRange(new ushort[] { 0, 1, 3 });
		    triangles.AddRange(new ushort[] { 0, 2, 3 });
		    triangles.AddRange(new ushort[] { 1, 3, 4 });
		    triangles.AddRange(new ushort[] { 2, 3, 5 });
		    triangles.AddRange(new ushort[] { 1, 4, 6 });
		    triangles.AddRange(new ushort[] { 2, 5, 7 });
		    triangles.AddRange(new ushort[] { 1, 6, 8 });
		    triangles.AddRange(new ushort[] { 2, 7, 8 });
		    triangles.AddRange(new ushort[] { 0, 1, 8 });
		    triangles.AddRange(new ushort[] { 0, 2, 8 });
		    triangles2.AddRange(new ushort[] { 9, 10, 11 });
		    triangles2.AddRange(new ushort[] { 11, 12, 9 });
		    triangles3.AddRange(new ushort[] { 3, 13, 4 });
		    triangles3.AddRange(new ushort[] { 14, 13, 4 });
		    triangles3.AddRange(new ushort[] { 3, 13, 5 });
		    triangles3.AddRange(new ushort[] { 15, 13, 5 });
		    triangles3.AddRange(new ushort[] { 6, 8, 16 });
		    triangles3.AddRange(new ushort[] { 18, 8, 16 });
		    triangles3.AddRange(new ushort[] { 7, 8, 17 });
		    triangles3.AddRange(new ushort[] { 19, 8, 17 });
		    
	    }
	    
	    else if (angle > 2*Mathf.Atan2(width,length))
	    {
		    bool shadowType = angle > 2 * Mathf.Atan2(width + shadowWidth, length);
		    vertices.Add(Vector3.zero);
		    vertices.Add((length - width) * new Vector3(n11, n12, 0));
		    vertices.Add((length - width) * new Vector3(n21, n22, 0));
		    vertices.Add(width / Mathf.Sin(angle / 2) * CreateVector3WithRadius(mid));
		    vertices.Add(new Vector3(-width * n12 + length * n11, width * n11 + length * n12));
		    vertices.Add(new Vector3(width * n22 + length * n21, -width * n21 + length * n22));
		    vertices.Add(new Vector3(width * n12 + length * n11, -width * n11 + length * n12));
		    vertices.Add(new Vector3(-width * n22 + length * n21, width * n21 + length * n22));
		    vertices.Add(new Vector3(radius * n12 + circlex, -radius * n11 + circley));
		    vertices.Add(new Vector3(-radius * n22 + circlex, radius * n21 + circley));
		    vertices.Add(new Vector3(circlex, circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) + circlex, -(radius+shadowWidth) + circley));
		    vertices.Add(new Vector3((radius+shadowWidth) + circlex, -(radius+shadowWidth) + circley));
		    vertices.Add(new Vector3((radius+shadowWidth) + circlex, (radius+shadowWidth) + circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) + circlex, (radius+shadowWidth) + circley));
		    
		    vertices.Add(new Vector3((width+shadowWidth) * n12 + length * n11, -(width+shadowWidth) * n11 + length * n12));
		    vertices.Add(new Vector3(-(width+shadowWidth) * n22 + length * n21, (width+shadowWidth) * n21 + length * n22));
		    vertices.Add(new Vector3((radius+shadowWidth) * n12 + circlex, -(radius+shadowWidth) * n11 + circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) * n22 + circlex, (radius+shadowWidth) * n21 + circley));
		    if (shadowType)
		    {
			    vertices.Add((width+shadowWidth) / Mathf.Sin(angle / 2) * CreateVector3WithRadius(mid));
			    vertices.Add(new Vector3(-(width+shadowWidth) * n12 + length * n11, (width+shadowWidth) * n11 + length * n12));
			    vertices.Add(new Vector3((width + shadowWidth) * n22 + length * n21, -(width + shadowWidth) * n21 + length * n22));
		    }
		    else
		    {
			    vertices.Add(length / Mathf.Cos(angle / 2) * CreateVector3WithRadius(mid));
		    }
		    
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, radius));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(1, 0));
		    uvs.Add(new Vector2(1, 1));
		    uvs.Add(new Vector2(0, 1));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    if (shadowType)
		    {
			    uvs.Add(new Vector2(0, shadowWidth));
			    uvs.Add(new Vector2(0, shadowWidth));
			    uvs.Add(new Vector2(0, shadowWidth));
		    }
		    else
		    {
			    uvs.Add(new Vector2(0, length * Mathf.Tan(angle / 2)-width));
		    }
		    //angle < 2.0943952f
		    
		    triangles.AddRange(new ushort[] { 0, 1, 3 });
		    triangles.AddRange(new ushort[] { 0, 2, 3 });
		    triangles.AddRange(new ushort[] { 1, 3, 4 });
		    triangles.AddRange(new ushort[] { 2, 3, 5 });
		    triangles.AddRange(new ushort[] { 1, 4, 6 });
		    triangles.AddRange(new ushort[] { 2, 5, 7 });
		    triangles.AddRange(new ushort[] { 1, 6, 8 });
		    triangles.AddRange(new ushort[] { 2, 7, 9 });
		    triangles.AddRange(new ushort[] { 0, 1, 8 });
		    triangles.AddRange(new ushort[] { 0, 2, 9 });
		    triangles.AddRange(new ushort[] { 0, 8, 10 });
		    triangles.AddRange(new ushort[] { 0, 9, 10 });
		    triangles2.AddRange(new ushort[] { 11, 12, 13 });
		    triangles2.AddRange(new ushort[] { 13, 14, 11 });//3 4 5 15
		    triangles3.AddRange(new ushort[] { 6, 8, 15 });
		    triangles3.AddRange(new ushort[] { 7, 9, 16 });
		    triangles3.AddRange(new ushort[] {17, 8, 15 });
		    triangles3.AddRange(new ushort[] { 18, 9, 16 });
		    if (shadowType)
		    {
			    triangles3.AddRange(new ushort[] { 3, 19, 4 });
			    triangles3.AddRange(new ushort[] { 20, 19, 4 });
			    triangles3.AddRange(new ushort[] { 3, 19, 5 });
			    triangles3.AddRange(new ushort[] { 21, 19, 5 });
		    }
		    else
		    {
			    triangles3.AddRange(new ushort[] { 3, 4, 19 });
			    triangles3.AddRange(new ushort[] { 3, 5, 19 });
		    }
		    
	    }
	    else if (angle == 0)
	    {
		    vertices.Add(new Vector3(circlex,circley));//0
		    vertices.Add((length - width) * new Vector3(n11, n12, 0));//1
		    vertices.Add(new Vector3(width * n22 + length * n21, -width * n21 + length * n22));//5,7,9->2
		    vertices.Add(new Vector3(-width * n12 + length * n11, width * n11 + length * n12));//6,8,10->3
		    vertices.Add(new Vector3(radius * n12 + circlex, -radius * n11 + circley));//11->4
		    vertices.Add(new Vector3(-radius * n22 + circlex, radius * n21 + circley));//12->5
		    vertices.Add(new Vector3(-(radius+shadowWidth) + circlex, -(radius+shadowWidth) + circley));//13->6
		    vertices.Add(new Vector3((radius+shadowWidth) + circlex, -(radius+shadowWidth) + circley));//14->7
		    vertices.Add(new Vector3((radius+shadowWidth) + circlex, (radius+shadowWidth) + circley));//15->8
		    vertices.Add(new Vector3(-(radius+shadowWidth) + circlex, (radius+shadowWidth) + circley));//16->9
		    vertices.Add(new Vector3((width+shadowWidth) * n12 + length * n11, -(width+shadowWidth) * n11 + length * n12));//17->10
		    vertices.Add(new Vector3(-(width+shadowWidth) * n22 + length * n21, (width+shadowWidth) * n21 + length * n22));//18->11
		    vertices.Add(new Vector3((radius+shadowWidth) * n12 + circlex, -(radius+shadowWidth) * n11 + circley));//19->12
		    vertices.Add(new Vector3(-(radius+shadowWidth) * n22 + circlex, (radius+shadowWidth) * n21 + circley));//20->13
		    

		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    //uvs.Add(new Vector2(0, radius));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(1, 0));
		    uvs.Add(new Vector2(1, 1));
		    uvs.Add(new Vector2(0, 1));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    
		    /*
		    triangles.AddRange(new ushort[] { 0, 1, 3 });
		    triangles.AddRange(new ushort[] { 0, 2, 3 });
		    triangles.AddRange(new ushort[] { 1, 3, 7 });
		    triangles.AddRange(new ushort[] { 2, 3, 8 });
		    triangles.AddRange(new ushort[] { 3, 5, 7 });
		    triangles.AddRange(new ushort[] { 3, 6, 8 });
		    triangles.AddRange(new ushort[] { 3, 4, 5 });
		    triangles.AddRange(new ushort[] { 3, 4, 6 });
		    triangles.AddRange(new ushort[] { 1, 7, 9 });
		    triangles.AddRange(new ushort[] { 2, 8, 10 });
		    triangles.AddRange(new ushort[] { 1, 9, 11 });
		    triangles.AddRange(new ushort[] { 2, 10, 12 });
		    triangles.AddRange(new ushort[] { 1, 11, 0 });
		    triangles.AddRange(new ushort[] { 2, 12, 0 });*/
		    triangles.AddRange(new ushort[] { 1, 2, 3 });
		    triangles.AddRange(new ushort[] { 1, 2, 4 });
		    triangles.AddRange(new ushort[] { 1, 3, 5 });
		    triangles.AddRange(new ushort[] { 0, 1, 4 });
		    triangles.AddRange(new ushort[] { 0, 1, 5 });
		    //triangles.AddRange(new ushort[] { 0, 11, 0 });
		    //triangles.AddRange(new ushort[] { 0, 12, 0 });
		    triangles2.AddRange(new ushort[] { 6, 7, 8 });
		    triangles2.AddRange(new ushort[] { 8, 9, 6 });
		    
		    triangles3.AddRange(new ushort[] { 2, 4, 10 });
		    triangles3.AddRange(new ushort[] { 3, 5, 11 });
		    triangles3.AddRange(new ushort[] { 12, 4, 10 });
		    triangles3.AddRange(new ushort[] { 13, 5, 11 });
	    }
	    else if (angle < 0.08726646f)
	    {
		    vertices.Add(Vector3.zero);//0
		    vertices.Add((length - width) * new Vector3(n11, n12, 0));//1
		    vertices.Add((length - width) * new Vector3(n21, n22, 0));//2
		    vertices.Add((length - width) / (-Mathf.Sin(angle / 2) + Mathf.Cos(angle / 2)) * CreateVector3WithRadius(mid));//3
		    vertices.Add(length / Mathf.Cos(angle / 2) * CreateVector3WithRadius(mid));//4
		    vertices.Add(new Vector3(width * n22 + length * n21, -width * n21 + length * n22));//5
		    vertices.Add(new Vector3(-width * n12 + length * n11, width * n11 + length * n12));//6
		    vertices.Add(new Vector3(length * n21 + width * n12, length * n22 - width * n11) / Mathf.Cos(angle));//7
		    vertices.Add(new Vector3(length * n11 - width * n22, length * n12 + width * n21) / Mathf.Cos(angle));//8
		    vertices.Add(new Vector3(width * n12 + length * n11, -width * n11 + length * n12));//9
		    vertices.Add(new Vector3(-width * n22 + length * n21, width * n21 + length * n22));//10
		    vertices.Add(new Vector3(radius * n12 + circlex, -radius * n11 + circley));//11
		    vertices.Add(new Vector3(-radius * n22 + circlex, radius * n21 + circley));//12
		    //vertices.Add(new Vector3(circlex, circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) + circlex, -(radius+shadowWidth) + circley));//13
		    vertices.Add(new Vector3((radius+shadowWidth) + circlex, -(radius+shadowWidth) + circley));//14
		    vertices.Add(new Vector3((radius+shadowWidth) + circlex, (radius+shadowWidth) + circley));//15
		    vertices.Add(new Vector3(-(radius+shadowWidth) + circlex, (radius+shadowWidth) + circley));//16
		    vertices.Add(new Vector3((width+shadowWidth) * n12 + length * n11, -(width+shadowWidth) * n11 + length * n12));//17
		    vertices.Add(new Vector3(-(width+shadowWidth) * n22 + length * n21, (width+shadowWidth) * n21 + length * n22));//18
		    vertices.Add(new Vector3((radius+shadowWidth) * n12 + circlex, -(radius+shadowWidth) * n11 + circley));//19
		    vertices.Add(new Vector3(-(radius+shadowWidth) * n22 + circlex, (radius+shadowWidth) * n21 + circley));//20
		    

		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, DistanceFromPointToLine(vertices[3],vertices[5],vertices[10])));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    //uvs.Add(new Vector2(0, radius));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(1, 0));
		    uvs.Add(new Vector2(1, 1));
		    uvs.Add(new Vector2(0, 1));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    
		    
		    triangles.AddRange(new ushort[] { 0, 1, 3 });
		    triangles.AddRange(new ushort[] { 0, 2, 3 });
		    triangles.AddRange(new ushort[] { 1, 3, 7 });
		    triangles.AddRange(new ushort[] { 2, 3, 8 });
		    triangles.AddRange(new ushort[] { 3, 5, 7 });
		    triangles.AddRange(new ushort[] { 3, 6, 8 });
		    triangles.AddRange(new ushort[] { 3, 4, 5 });
		    triangles.AddRange(new ushort[] { 3, 4, 6 });
		    triangles.AddRange(new ushort[] { 1, 7, 9 });
		    triangles.AddRange(new ushort[] { 2, 8, 10 });
		    triangles.AddRange(new ushort[] { 1, 9, 11 });
		    triangles.AddRange(new ushort[] { 2, 10, 12 });
		    triangles.AddRange(new ushort[] { 1, 11, 0 });
		    triangles.AddRange(new ushort[] { 2, 12, 0 });
		    //triangles.AddRange(new ushort[] { 0, 11, 0 });
		    //triangles.AddRange(new ushort[] { 0, 12, 0 });
		    triangles2.AddRange(new ushort[] { 13, 14, 15 });
		    triangles2.AddRange(new ushort[] { 15, 16, 13 });
		    triangles3.AddRange(new ushort[] { 9, 11, 17 });
		    triangles3.AddRange(new ushort[] { 10, 12, 18 });
		    triangles3.AddRange(new ushort[] { 19, 11, 17 });
		    triangles3.AddRange(new ushort[] { 20, 12, 18 });
	    }
	    
	    else
	    {
		    vertices.Add(Vector3.zero);
		    vertices.Add((length - width) * new Vector3(n11, n12, 0));
		    vertices.Add((length - width) * new Vector3(n21, n22, 0));
		    vertices.Add((length - width) / (-Mathf.Sin(angle / 2) + Mathf.Cos(angle / 2)) * CreateVector3WithRadius(mid));
		    vertices.Add(length / Mathf.Cos(angle / 2) * CreateVector3WithRadius(mid));
		    vertices.Add(new Vector3(width * n22 + length * n21, -width * n21 + length * n22));
		    vertices.Add(new Vector3(-width * n12 + length * n11, width * n11 + length * n12));
		    vertices.Add(new Vector3(length * n21 + width * n12, length * n22 - width * n11) / Mathf.Cos(angle));
		    vertices.Add(new Vector3(length * n11 - width * n22, length * n12 + width * n21) / Mathf.Cos(angle));
		    vertices.Add(new Vector3(width * n12 + length * n11, -width * n11 + length * n12));
		    vertices.Add(new Vector3(-width * n22 + length * n21, width * n21 + length * n22));
		    vertices.Add(new Vector3(radius * n12 + circlex, -radius * n11 + circley));
		    vertices.Add(new Vector3(-radius * n22 + circlex, radius * n21 + circley));
		    vertices.Add(new Vector3(circlex, circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) + circlex, -(radius+shadowWidth) + circley));
		    vertices.Add(new Vector3((radius+shadowWidth) + circlex, -(radius+shadowWidth) + circley));
		    vertices.Add(new Vector3((radius+shadowWidth) + circlex, (radius+shadowWidth) + circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) + circlex, (radius+shadowWidth) + circley));
		    vertices.Add(new Vector3((width+shadowWidth) * n12 + length * n11, -(width+shadowWidth) * n11 + length * n12));
		    vertices.Add(new Vector3(-(width+shadowWidth) * n22 + length * n21, (width+shadowWidth) * n21 + length * n22));
		    vertices.Add(new Vector3((radius+shadowWidth) * n12 + circlex, -(radius+shadowWidth) * n11 + circley));
		    vertices.Add(new Vector3(-(radius+shadowWidth) * n22 + circlex, (radius+shadowWidth) * n21 + circley));
		    

		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, width));
		    uvs.Add(new Vector2(0, DistanceFromPointToLine(vertices[3],vertices[5],vertices[10])));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(0, radius));
		    uvs.Add(new Vector2(0, 0));
		    uvs.Add(new Vector2(1, 0));
		    uvs.Add(new Vector2(1, 1));
		    uvs.Add(new Vector2(0, 1));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    uvs.Add(new Vector2(0, shadowWidth));
		    
		    
		    triangles.AddRange(new ushort[] { 0, 1, 3 });
		    triangles.AddRange(new ushort[] { 0, 2, 3 });
		    triangles.AddRange(new ushort[] { 1, 3, 7 });
		    triangles.AddRange(new ushort[] { 2, 3, 8 });
		    triangles.AddRange(new ushort[] { 3, 5, 7 });
		    triangles.AddRange(new ushort[] { 3, 6, 8 });
		    triangles.AddRange(new ushort[] { 3, 4, 5 });
		    triangles.AddRange(new ushort[] { 3, 4, 6 });
		    triangles.AddRange(new ushort[] { 1, 7, 9 });
		    triangles.AddRange(new ushort[] { 2, 8, 10 });
		    triangles.AddRange(new ushort[] { 1, 9, 11 });
		    triangles.AddRange(new ushort[] { 2, 10, 12 });
		    triangles.AddRange(new ushort[] { 1, 11, 0 });
		    triangles.AddRange(new ushort[] { 2, 12, 0 });
		    triangles.AddRange(new ushort[] { 0, 11, 13 });
		    triangles.AddRange(new ushort[] { 0, 12, 13 });
		    triangles2.AddRange(new ushort[] { 14, 15, 16 });
		    triangles2.AddRange(new ushort[] { 16, 17, 14 });
		    triangles3.AddRange(new ushort[] { 9, 11, 18 });
		    triangles3.AddRange(new ushort[] { 10, 12, 19 });
		    triangles3.AddRange(new ushort[] { 20, 11, 18 });
		    triangles3.AddRange(new ushort[] { 21, 12, 19 });
		    
		    
		    
	    }

	    mesh.SetVertices(vertices);
	    mesh.SetUVs(0, uvs);
	    mesh.SetTriangles(triangles,0);
	    mesh.SetTriangles(triangles2, 1);
	    mesh.SetTriangles(triangles3, 2);
	    
	    return (1/(radius+shadowWidth),Mathf.Cos(a[1]+Mathf.PI/2),Mathf.Sin(a[1]+Mathf.PI/2),Mathf.Cos(a[0]-Mathf.PI/2),Mathf.Sin(a[0]-Mathf.PI/2));

    }
    public static Vector3 CreateVector3WithRadius(float rad)
    {
	    return new Vector3(Mathf.Cos(rad), Mathf.Sin(rad));
    }
    Mesh CreateCircle(float radius, int segments = 100, float x = 0f,float y = 0f )
    {
	    Mesh mesh = new Mesh();
	    Vector3[] vertices = new Vector3[segments + 1];
	    int[] indexes = new int[3 * segments];
	    vertices[0] = new Vector3(x, y, 0);
	    for (int i = 0; i < segments; i++)
	    {
		    float currentAngle = 2 * i * Mathf.PI / segments;
		    vertices[i+1] = radius * new Vector3(Mathf.Cos(currentAngle), Mathf.Sin(currentAngle), 0f);
		    indexes[3*i] = 0;
		    indexes[3*i+1] = i+1;
		    indexes[3*i+2] = i+2;
		    
	    }

	    indexes[3 * segments - 1] = 1;
	    mesh.vertices = vertices;
	    mesh.triangles = indexes;
	    return mesh;
    }
}
