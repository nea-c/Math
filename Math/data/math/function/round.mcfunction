data remove storage math: error
data modify storage math:comparison validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:comparison {validation_a:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math:comparison predicate.rounding_integer_input.minimum set compute default math:internal/comparison/predicate/rounding/integer_input/minimum
execute if predicate math:internal/rounding/integer_input run data modify storage math: ans set compute default math:common/input/x
execute if predicate math:internal/rounding/integer_input run return 1
data modify storage math:internal x set compute default math:common/rounding/add_half
function math:internal/floor_x
data modify storage math: ans set compute default math:common/input/z
return 1
