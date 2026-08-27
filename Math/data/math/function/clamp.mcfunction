data remove storage math: error
data modify storage math:comparison validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:comparison {validation_a:0.0f} run return run function math:internal/invalid_number
data modify storage math:comparison validation_min set compute default math:internal/comparison/finite/min
execute unless data storage math:comparison {validation_min:0.0f} run return run function math:internal/invalid_number
data modify storage math:comparison validation_max set compute default math:internal/comparison/finite/max
execute unless data storage math:comparison {validation_max:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math:internal z set from storage math: min
data modify storage math:internal w set from storage math: max
data modify storage math:comparison predicate.range_min_greater_than_max.maximum set compute default math:internal/comparison/predicate/range/min_greater_than_max/maximum
execute if predicate math:internal/range/min_greater_than_max run data remove storage math: ans
execute if predicate math:internal/range/min_greater_than_max run data modify storage math: error set value "invalid_clamp_range"
execute if predicate math:internal/range/min_greater_than_max run return fail
data modify storage math: ans set compute default math:common/comparison/clamp
return 1
