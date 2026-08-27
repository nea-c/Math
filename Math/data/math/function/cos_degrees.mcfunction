data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
data modify storage math:internal x set from storage math: a
data modify storage math:internal x set compute default math:common/conversion/rad
execute if predicate math:internal/reciprocal/zero run data modify storage math: ans set value 1.0f
execute if predicate math:internal/reciprocal/zero run return 1
function math:internal/cos_x
data modify storage math: ans set compute default math:common/input/x
return 1
