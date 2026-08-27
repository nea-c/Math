data remove storage math: error
data modify storage math:comparison validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:comparison {validation_a:0.0f} run return run function math:internal/invalid_number
data modify storage math:internal x set from storage math: a
execute if data storage math:internal {x:0.0f} run data remove storage math: ans
execute if data storage math:internal {x:0.0f} run data modify storage math: error set value "division_by_zero"
execute if data storage math:internal {x:0.0f} run return fail
data modify storage math:internal y set value 1.0f
function math:internal/reciprocal_x
data modify storage math: ans set compute default math:common/input/x
return 1
