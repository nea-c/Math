data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
data modify storage math:internal x set from storage math: a
data modify storage math:internal x set compute default math:common/conversion/rad
execute if predicate math:internal/reciprocal/zero run data modify storage math: ans set compute default math:common/input/x
execute if predicate math:internal/reciprocal/zero run return 1
function math:internal/tan_x
execute if predicate math:internal/tan/undefined_degrees run data remove storage math: ans
execute if predicate math:internal/tan/undefined_degrees run data modify storage math: error set value "undefined_tangent"
execute if predicate math:internal/tan/undefined_degrees run return fail
data modify storage math:internal z set compute default math:common/reciprocal/00
data modify storage math: ans set compute default math:tan/00
return 1
