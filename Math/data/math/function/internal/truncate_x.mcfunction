execute unless predicate math:internal/range/negative run return run function math:internal/floor_x
data modify storage math:internal x set compute default math:common/rounding/negate
function math:internal/floor_x
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal z set compute default math:common/rounding/negate
return 1
