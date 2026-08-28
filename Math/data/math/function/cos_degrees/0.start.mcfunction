data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math:internal x set compute default math:common/conversion/rad
execute if data storage math:internal {x:0.0f} run data modify storage math: ans set value 1.0f
execute if data storage math:internal {x:0.0f} run return 1
function math:.common/cos/0.start
data modify storage math: ans set compute default math:common/input/x
return 1
