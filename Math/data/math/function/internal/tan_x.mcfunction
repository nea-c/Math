function math:internal/sin_x
data modify storage math: ans set compute default math:common/input/x
data modify storage math:internal x set from storage math:internal w
function math:internal/cos_x
execute if predicate math:internal/tan/undefined run data remove storage math: ans
execute if predicate math:internal/tan/undefined run data modify storage math: error set value "undefined_tangent"
execute if predicate math:internal/tan/undefined run return fail
data modify storage math:internal z set compute default math:common/reciprocal/00
data modify storage math: ans set compute default math:tan/00
return 1
