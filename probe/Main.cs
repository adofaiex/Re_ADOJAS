using System;
using System.IO;
using System.Threading;
using System.Collections.Concurrent;
using ADOFAI;
using HarmonyLib;
using UnityEngine;
using UnityModManagerNet;

namespace DecorationProbe
{
    public static class Main
    {
        private static UnityModManager.ModEntry? _entry;
        private static Harmony? _harmony;
        private static readonly string LogDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            "AppData", "LocalLow", "7th Beat Games", "A Dance of Fire and Ice");
        private static readonly string LogFile = Path.Combine(LogDir, "DecorationProbe_ADOFAI.log");

        // Async write queue
        private static readonly BlockingCollection<string> _queue = new();
        private static Thread? _writerThread;
        private static StreamWriter? _writer;

        public static bool Load(object modEntry)
        {
            _entry = (UnityModManager.ModEntry)modEntry;
            try
            {
                Directory.CreateDirectory(LogDir);
                _writerThread = new Thread(WriteLoop) { IsBackground = true, Priority = System.Threading.ThreadPriority.BelowNormal };
                _writerThread.Start();

                _harmony = new Harmony(_entry.Info.Id);
                _harmony.PatchAll(typeof(Main).Assembly);
                _entry.Logger.Log($"[DecorationProbe] Logging to: {LogFile}");
                return true;
            }
            catch (Exception ex)
            {
                _entry.Logger.Error(ex.ToString());
                return false;
            }
        }

        private static void WriteLoop()
        {
            try
            {
                _writer = new StreamWriter(LogFile, false) { AutoFlush = false };
                foreach (var line in _queue.GetConsumingEnumerable())
                {
                    _writer.WriteLine(line);
                    if (_queue.Count == 0)
                        _writer.Flush(); // flush when queue is drained
                }
            }
            catch { }
            finally { _writer?.Dispose(); }
        }

        public static void Log(string msg)
        {
            try { _queue.Add($"[{DateTime.Now:HH:mm:ss.fff}] {msg}"); }
            catch { }
        }

        public static void Flush() { try { _writer?.Flush(); } catch { } }
    }

    // ────────────── Decoration Setup (initial state) ──────────────
    [HarmonyPatch(typeof(scrDecoration), nameof(scrDecoration.Setup))]
    public static class Patch_DecoSetup
    {
        static void Postfix(scrDecoration __instance, LevelEvent ev)
        {
            if (ev.eventType != LevelEventType.AddDecoration
                && ev.eventType != LevelEventType.AddObject
                && ev.eventType != LevelEventType.AddParticle
                && ev.eventType != LevelEventType.AddText)
                return;

            var pos = __instance.startPos;
            var scale = __instance.scaleVec;
            var rot = __instance.startRot;
            var opacity = __instance.opacity;
            var color = __instance.color;
            var depth = (int)ev["depth"];
            var tags = ev["tag"]?.ToString() ?? "";
            var relativeTo = (DecPlacementType)ev["relativeTo"];
            var lockScale = __instance.lockScale;
            var scaleMul = __instance.scaleMultiplier;

            string objType = ev.eventType == LevelEventType.AddObject ? (ev["objectType"]?.ToString() ?? "") : "";
            string image = ev.eventType == LevelEventType.AddDecoration ? (ev["decorationImage"]?.ToString() ?? "") : "";

            string extra = "";
            if (__instance is scrObjectDecoration objDec)
            {
                extra = $"|objType={objDec.objectType}";
                if (objDec.objectType == ObjectDecorationType.Planet)
                {
                    var pr = objDec.planetRenderer;
                    if (pr != null)
                    {
                        var t = pr.transform;
                        extra += $"|planetLocalScale=({t.localScale.x:F4},{t.localScale.y:F4},{t.localScale.z:F4})";
                        extra += $"|planetWorldScale=({t.lossyScale.x:F4},{t.lossyScale.y:F4},{t.lossyScale.z:F4})";
                    }
                }
            }

            Main.Log($"SETUP|{ev.eventType}|floor={ev.floor}|tags={tags}|relativeTo={relativeTo}" +
                $"|pos=({pos.x:F4},{pos.y:F4})|scale=({scale.x:F4},{scale.y:F4})|rot={rot:F2}" +
                $"|opacity={opacity:F3}|color=({color.r:F3},{color.g:F3},{color.b:F3},{color.a:F3})" +
                $"|depth={depth}|lockScale={lockScale}|scaleMul={scaleMul:F3}" +
                $"|objType={objType}|image={image}{extra}");
        }
    }

    // ────────────── MoveDecoration event ──────────────
    [HarmonyPatch(typeof(ffxMoveDecorationsPlus), nameof(ffxMoveDecorationsPlus.StartEffect))]
    public static class Patch_MoveDeco
    {
        static void Prefix(ffxMoveDecorationsPlus __instance, scrPlanet planet)
        {
            var dm = __instance.decManager;
            if (dm == null) return;

            string tags = string.Join(",", __instance.targetTags);
            int matched = 0;
            foreach (var d in dm.GetTaggedDecorations(__instance.targetTags))
            {
                matched++;
                LogDecorationState($"  DEC", d);
            }

            Main.Log($"MOVE|tags={tags}|matched={matched}|dur={__instance.duration:F4}" +
                $"|ease={__instance.ease}|noTween={__instance.forceDontTweenMovement}");

            // Log targets
            if (__instance.positionUsed)
                Main.Log($"  TARGET|pos=({__instance.targetPos.x:F4},{__instance.targetPos.y:F4})");
            if (__instance.scaleUsed)
                Main.Log($"  TARGET|scale=({__instance.targetScaleV2.x:F4},{__instance.targetScaleV2.y:F4})|single={__instance.targetScale}");
            if (__instance.rotationUsed)
                Main.Log($"  TARGET|rot={__instance.targetRot:F2}");
            if (__instance.opacityUsed)
                Main.Log($"  TARGET|opacity={__instance.targetOpacity:F3}");
            if (__instance.colorUsed)
                Main.Log($"  TARGET|color=({__instance.targetColor.r:F3},{__instance.targetColor.g:F3},{__instance.targetColor.b:F3},{__instance.targetColor.a:F3})");
        }

        static void LogDecorationState(string prefix, scrDecoration d)
        {
            var pos = d.pivotPosVec;
            var offset = d.pivotOffsetVec;
            var scale = d.scaleVec;
            var camMul = d.camScaleMultiplier;
            var pivotLocal = d.pivotTrans?.localScale ?? Vector3.zero;
            var childLocal = d.childTransform?.localScale ?? Vector3.zero;

            string extra = "";
            if (d is scrObjectDecoration objDec)
            {
                extra = $"|objType={objDec.objectType}";
                if (objDec.objectType == ObjectDecorationType.Planet && objDec.planetRenderer != null)
                {
                    var t = objDec.planetRenderer.transform;
                    extra += $"|planetLocalScale=({t.localScale.x:F4},{t.localScale.y:F4},{t.localScale.z:F4})";
                    extra += $"|planetWorldScale=({t.lossyScale.x:F4},{t.lossyScale.y:F4},{t.lossyScale.z:F4})";
                }
            }

            Main.Log($"{prefix}|{d.decType}|name={d.gameObject?.name}" +
                $"|pos=({pos.x:F4},{pos.y:F4})|offset=({offset.x:F4},{offset.y:F4})" +
                $"|scaleVec=({scale.x:F4},{scale.y:F4})|camMul={camMul:F4}" +
                $"|pivotLocalScale=({pivotLocal.x:F4},{pivotLocal.y:F4},{pivotLocal.z:F4})" +
                $"|childLocalScale=({childLocal.x:F4},{childLocal.y:F4},{childLocal.z:F4})" +
                $"|opacity={d.opacity:F3}|rot={d.rotAngle:F2}" +
                $"|color=({d.color.r:F3},{d.color.g:F3},{d.color.b:F3},{d.color.a:F3})" +
                extra);
        }
    }

    // ────────────── Per-frame Planet decoration state (sampled) ──────────────
    [HarmonyPatch(typeof(scrDecoration), nameof(scrDecoration.UpdatePosition))]
    public static class Patch_DecPosition
    {
        static void Postfix(scrDecoration __instance)
        {
            if (__instance.decType != DecorationType.Object) return;
            if (__instance is not scrObjectDecoration objDec) return;
            if (objDec.objectType != ObjectDecorationType.Planet) return;

            var pivot = __instance.pivotPosVec;
            var offset = __instance.pivotOffsetVec;
            var scale = __instance.scaleVec;
            var camMul = __instance.camScaleMultiplier;
            var pivotLocal = __instance.pivotTrans?.localScale ?? Vector3.zero;
            var childLocal = __instance.childTransform?.localScale ?? Vector3.zero;

            string planetExtra = "";
            if (objDec.planetRenderer != null)
            {
                var t = objDec.planetRenderer.transform;
                planetExtra = $"|planetLocalScale=({t.localScale.x:F4},{t.localScale.y:F4},{t.localScale.z:F4})" +
                    $"|planetWorldScale=({t.lossyScale.x:F4},{t.lossyScale.y:F4},{t.lossyScale.z:F4})";
            }

            Main.Log($"POS|{__instance.gameObject?.name}" +
                $"|pivot=({pivot.x:F4},{pivot.y:F4})|offset=({offset.x:F4},{offset.y:F4})" +
                $"|scaleVec=({scale.x:F4},{scale.y:F4})|camMul={camMul:F4}" +
                $"|pivotLocalScale=({pivotLocal.x:F4},{pivotLocal.y:F4},{pivotLocal.z:F4})" +
                $"|childLocalScale=({childLocal.x:F4},{childLocal.y:F4},{childLocal.z:F4})" +
                planetExtra);
        }
    }
}
