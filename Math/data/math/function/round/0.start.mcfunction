data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/invalid_number/0.start
data modify storage math:internal x set from storage math: a
data modify storage math:internal w_comparison.predicate.rounding_integer_input.minimum set compute default math:internal/comparison/predicate/rounding/integer_input/minimum
execute if predicate math:internal/rounding/integer_input run data modify storage math: ans set compute default math:common/input/x
execute if predicate math:internal/rounding/integer_input run return 1
data modify storage math:internal x set compute default math:common/rounding/add_half
function math:.common/floor/0.start
data modify storage math: ans set compute default math:common/input/z
return 1
