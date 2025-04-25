export function debugSceneObjects(scene) {
  console.log("=== DÉBUT DE LA HIÉRARCHIE DE LA SCÈNE ===");

  function traverseObject(object, depth = 0) {
    const indent = "  ".repeat(depth);
    const position = object.position
      ? `(x:${object.position.x.toFixed(2)}, y:${
        object.position.y.toFixed(2)
      }, z:${object.position.z.toFixed(2)})`
      : "";
    const type = object.type || "Unknown";
    const name = object.name || "unnamed";

    console.log(`${indent}► ${type}: "${name}" ${position}`);

    if (object.children && object.children.length > 0) {
      object.children.forEach((child) => traverseObject(child, depth + 1));
    }
  }

  traverseObject(scene);
  console.log("=== FIN DE LA HIÉRARCHIE DE LA SCÈNE ===");
}

export function advancedDebugSceneObjects(scene) {
  console.log("=== DÉBUT DE LA HIÉRARCHIE DE LA SCÈNE ===");

  function traverseObject(object, depth = 0) {
    const indent = "  ".repeat(depth);
    const position = object.position
      ? `(x:${object.position.x.toFixed(2)}, y:${
        object.position.y.toFixed(2)
      }, z:${object.position.z.toFixed(2)})`
      : "";
    const type = object.type || "Unknown";
    const name = object.name || "unnamed";

    console.log(`${indent}► ${type}: "${name}" ${position}`);

    if (object.type === "Mesh") {
      console.log(
        `${indent}  - Material: ${object.material.type}, Color: ${
          object.material.color
            ? "#" + object.material.color.getHexString()
            : "N/A"
        }`,
      );
      console.log(
        `${indent}  - Geometry: ${object.geometry.type}, Vertices: ${
          object.geometry.attributes.position
            ? object.geometry.attributes.position.count
            : "N/A"
        }`,
      );
      console.log(`${indent}  - Visible: ${object.visible}`);
    }

    if (object.children && object.children.length > 0) {
      object.children.forEach((child) => traverseObject(child, depth + 1));
    }
  }

  traverseObject(scene);
  console.log("=== FIN DE LA HIÉRARCHIE DE LA SCÈNE ===");
}
