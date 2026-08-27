data remove storage math: error
data modify storage math:comparison validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:comparison {validation_a:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math:internal x set compute default math:common/conversion/rad
execute if data storage math:internal {x:0.0f} run data modify storage math: ans set compute default math:common/input/x
execute if data storage math:internal {x:0.0f} run return 1
function math:internal/tan_x
data modify storage math:comparison tan_domain set compute default math:tan/guard/degrees/compare_domain
data modify storage math:comparison predicate.tan_undefined_degrees.maximum set compute default math:internal/comparison/predicate/tan/undefined_degrees/maximum
execute if predicate math:internal/tan/undefined_degrees run data remove storage math: ans
execute if predicate math:internal/tan/undefined_degrees run data modify storage math: error set value "undefined_tangent"
execute if predicate math:internal/tan/undefined_degrees run return fail
data modify storage math:internal y set value 1.0f
function math:internal/reciprocal_x
data modify storage math:internal z set compute default math:common/input/x
data modify storage math: ans set compute default math:tan/00
return 1
