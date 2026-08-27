data remove storage math: error
data modify storage math:comparison validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:comparison {validation_a:0.0f} run return run function math:internal/invalid_number
data modify storage math:comparison validation_b set compute default math:internal/comparison/finite/b
execute unless data storage math:comparison {validation_b:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math:internal y set from storage math: b
execute if data storage math:internal {x:0.0f} run return run function math:internal/power_zero
execute if data storage math:internal {y:1.0f} run data modify storage math: ans set compute default math:common/input/x
execute if data storage math:internal {y:1.0f} run return 1
data modify storage math:comparison x_sign set compute default math:internal/comparison/x_zero
execute if predicate math:internal/range/negative run return run function math:internal/power_negative
return run function math:internal/power_positive
