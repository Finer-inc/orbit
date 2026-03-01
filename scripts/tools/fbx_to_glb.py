"""
Blender batch script: FBX → GLB conversion with texture fix.
Polyperfect Low Poly Epic City の FBX ファイルを GLB に変換し、
壊れたテクスチャパスを修正して albedo に正しく割り当てる。

Usage (PowerShell):
  & "C:\Program Files\Blender Foundation\Blender 3.6\blender.exe" --background --python fbx_to_glb.py

Or from WSL:
  "/mnt/c/Program Files/Blender Foundation/Blender 3.6/blender.exe" --background --python /path/to/fbx_to_glb.py
"""

import bpy
import os
import sys
import time

# ── Configuration ──────────────────────────────────────────────
ASSET_ROOT = r"C:\Godot\Projects\seirei-client\assets\polyperfect\Low Poly Epic City"
TEXTURE_DIR = os.path.join(ASSET_ROOT, "- Textures")
ALBEDO_TEX = os.path.join(TEXTURE_DIR, "atlas-albedo-LPEC.png")
EMISSION_TEX = os.path.join(TEXTURE_DIR, "atlas-emission-LPEC.png")

# FBX source directories (T = terrain/textured meshes only)
FBX_DIRS = [
    os.path.join(ASSET_ROOT, "T", "- Meshes_T"),
]

# GLB output directory (parallel to M/ and T/)
OUTPUT_ROOT = os.path.join(ASSET_ROOT, "GLB")


def collect_fbx_files():
    """Collect all .fbx files from source directories."""
    fbx_files = []
    for fbx_dir in FBX_DIRS:
        if not os.path.isdir(fbx_dir):
            print(f"SKIP: directory not found: {fbx_dir}")
            continue
        for root, _, files in os.walk(fbx_dir):
            for f in files:
                if f.lower().endswith(".fbx"):
                    fbx_files.append(os.path.join(root, f))
    return sorted(fbx_files)


def clear_scene():
    """Remove all objects, meshes, materials, images from the scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Clean orphan data
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)
    for block in bpy.data.images:
        bpy.data.images.remove(block)


def fix_materials():
    """Fix materials: correct metallic/roughness for all, fix broken textures."""
    albedo_img = None

    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue

        tree = mat.node_tree
        bsdf = None
        tex_node = None

        for node in tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                bsdf = node
            elif node.type == "TEX_IMAGE":
                tex_node = node

        if not bsdf:
            continue

        # Fix metallic/roughness for ALL materials (Unity: Metallic=0, Glossiness=0.014)
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = 0.986

        # Only fix textures for materials that already have a broken texture node
        if not tex_node:
            continue

        img = tex_node.image
        if img is not None and img.has_data:
            continue  # Texture is fine, skip

        # Load correct atlas texture
        if albedo_img is None:
            albedo_img = bpy.data.images.load(ALBEDO_TEX)
        tex_node.image = albedo_img

        # Move from Emission to Base Color
        base_color_input = bsdf.inputs.get("Base Color")
        if base_color_input:
            for link in list(tree.links):
                if link.to_socket == base_color_input:
                    tree.links.remove(link)
            tree.links.new(tex_node.outputs["Color"], base_color_input)

        # Remove emission connection
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if emission_input:
            for link in list(tree.links):
                if link.to_socket == emission_input:
                    tree.links.remove(link)


def convert_fbx_to_glb(fbx_path, glb_path):
    """Import FBX, fix materials, export as GLB."""
    clear_scene()

    # Import FBX
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    # Fix materials
    fix_materials()

    # Ensure output directory exists
    os.makedirs(os.path.dirname(glb_path), exist_ok=True)

    # Export as GLB
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_yup=True,
    )


def main():
    fbx_files = collect_fbx_files()
    total = len(fbx_files)
    print(f"\n{'='*60}")
    print(f"FBX → GLB Batch Converter")
    print(f"Found {total} FBX files")
    print(f"Output: {OUTPUT_ROOT}")
    print(f"{'='*60}\n")

    if total == 0:
        print("No FBX files found. Check ASSET_ROOT path.")
        return

    start_time = time.time()
    success = 0
    errors = []

    for i, fbx_path in enumerate(fbx_files, 1):
        # Compute relative path for output
        for fbx_dir in FBX_DIRS:
            if fbx_path.startswith(fbx_dir):
                rel = os.path.relpath(fbx_path, fbx_dir)
                break
        else:
            rel = os.path.basename(fbx_path)

        glb_path = os.path.join(OUTPUT_ROOT, os.path.splitext(rel)[0] + ".glb")

        # Skip if already converted
        if os.path.exists(glb_path):
            print(f"[{i}/{total}] SKIP (exists): {rel}")
            success += 1
            continue

        try:
            t0 = time.time()
            convert_fbx_to_glb(fbx_path, glb_path)
            dt = time.time() - t0
            print(f"[{i}/{total}] OK ({dt:.1f}s): {rel}")
            success += 1
        except Exception as e:
            print(f"[{i}/{total}] ERROR: {rel} — {e}")
            errors.append((rel, str(e)))

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Done: {success}/{total} converted in {elapsed:.0f}s")
    if errors:
        print(f"Errors ({len(errors)}):")
        for name, err in errors:
            print(f"  - {name}: {err}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
