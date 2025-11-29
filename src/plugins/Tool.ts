/**
 * 格式化对象名称 -- 避免类型名称与js对象名称冲突
 * @param objectName
 * @private
 */
function formatObjectName(objectName: string) {
  const reversed = objectName.split('').reverse().join('');
  return `_${objectName}__${reversed}`;
}
/**
 * Groups values from sourceMap according to the group key mapping.
 *
 * Example:
 * const valueMap = new Map([
 *   ['a', 1],
 *   ['b', 2],
 *   ['c', 3],
 *   ['d', 4],
 * ])
 *
 * const keyMap = new Map([
 *   ['a', 'X'],
 *   ['b', 'Y'],
 *   ['c', 'X'],
 * ])
 *
 * groupValuesByMappedKey(valueMap, keyMap)
 * // → Map(2) { 'X' => [1, 3], 'Y' => [2] }
 */
function groupValuesByMappedKey<K extends string, V, G extends string>(
  valueMap: Map<K, V>,
  keyMap: Map<K, G>,
): Map<G, V[]> {
  const groupedMap = new Map<G, V[]>();

  for (const [key, value] of valueMap.entries()) {
    if (keyMap.has(key)) {
      const groupKey = keyMap.get(key)!;
      const existing = groupedMap.get(groupKey) || [];
      groupedMap.set(groupKey, [...existing, value]);
    }
  }
  return groupedMap;
}
export { groupValuesByMappedKey, formatObjectName };
