data modify storage math:internal x set from storage math:internal y
function math:internal/truncate_x
execute unless predicate math:internal/power/exponent_integer run data remove storage math: ans
execute unless predicate math:internal/power/exponent_integer run data modify storage math: error set value "non_real_result"
execute unless predicate math:internal/power/exponent_integer run return fail
data modify storage math:internal x set from storage math: a
data modify storage math:internal x set compute default math:common/comparison/absolute
data modify storage math:internal y set from storage math: b
execute if predicate math:internal/power/exponent_large_even run return run function math:internal/power_positive
data modify storage math:internal x set from storage math:internal y
data modify storage math:internal y set value 0.5f
data modify storage math:internal w set compute default math:common/arithmetic/multiply
data modify storage math:internal x set from storage math:internal w
function math:internal/truncate_x
data modify storage math:internal x set from storage math:internal w
data modify storage math:internal y set from storage math:internal z
data modify storage math:internal z set compute default math:common/arithmetic/subtract
data modify storage math:internal x set from storage math: a
data modify storage math:internal x set compute default math:common/comparison/absolute
data modify storage math:internal y set from storage math: b
execute if predicate math:internal/power/exponent_odd run return run function math:internal/power_negative_odd
return run function math:internal/power_positive
