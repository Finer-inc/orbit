interface TreeProps {
  position?: [number, number, number]
  scale?: number
  trunkColor?: string
  leafColor?: string
}

export interface TreesProps {
  trees: TreeProps[]
}

function Tree({
  position = [0, 0, 0],
  scale = 1,
  trunkColor = "#9b6e4c",
  leafColor = "#4daa55",
}: TreeProps) {
  return (
    <group position={position} scale={scale}>
      {/* 幹: 五角柱 */}
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 1.5, 5]} />
        <meshStandardMaterial color={trunkColor} flatShading />
      </mesh>

      {/* 葉(下段): 六角錐 */}
      <mesh position={[0, 2.2, 0]}>
        <coneGeometry args={[1, 2, 6]} />
        <meshStandardMaterial color={leafColor} flatShading />
      </mesh>

      {/* 葉(上段・小さめ): 六角錐 */}
      <mesh position={[0, 3, 0]}>
        <coneGeometry args={[0.7, 1.5, 6]} />
        <meshStandardMaterial color={leafColor} flatShading />
      </mesh>
    </group>
  )
}

export default function Trees({ trees }: TreesProps) {
  return (
    <group>
      {trees.map((treeProps, index) => (
        <Tree key={index} {...treeProps} />
      ))}
    </group>
  )
}
