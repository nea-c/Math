data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/invalid_number/0.start
data modify storage math:internal x set from storage math: a
data modify storage math:internal x set compute default math:common/rounding/negate
function math:.common/floor/0.start
data modify storage math:internal x set from storage math:internal z
data modify storage math: ans set compute default math:common/rounding/negate
return 1
