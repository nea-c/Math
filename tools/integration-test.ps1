[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $MinecraftServerJar,

    [string] $JavaExecutable = 'java'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-Executable {
    param([Parameter(Mandatory = $true)][string] $Executable)

    if ([System.IO.Path]::IsPathFullyQualified($Executable)) {
        if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
            throw "Executable does not exist: $Executable"
        }
        return (Resolve-Path -LiteralPath $Executable).Path
    }

    $command = Get-Command -Name $Executable -CommandType Application -ErrorAction Stop | Select-Object -First 1
    return $command.Source
}

function Test-PathEqual {
    param(
        [Parameter(Mandatory = $true)][string] $Left,
        [Parameter(Mandatory = $true)][string] $Right
    )

    $comparison = if ($IsWindows) {
        [System.StringComparison]::OrdinalIgnoreCase
    }
    else {
        [System.StringComparison]::Ordinal
    }
    return [string]::Equals($Left, $Right, $comparison)
}

if (-not (Test-Path -LiteralPath $MinecraftServerJar -PathType Leaf)) {
    throw "Minecraft server JAR does not exist: $MinecraftServerJar"
}
$serverJar = (Resolve-Path -LiteralPath $MinecraftServerJar).Path
$java = Resolve-Executable -Executable $JavaExecutable
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$packSource = (Resolve-Path -LiteralPath (Join-Path $repositoryRoot 'Math')).Path
$temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
)
$testRoot = [System.IO.Path]::GetFullPath((Join-Path $temporaryRoot ("math-pack-test-" + [guid]::NewGuid().ToString('N'))))
$expectedParent = [System.IO.Directory]::GetParent($testRoot).FullName
if (-not (Test-PathEqual -Left $expectedParent -Right $temporaryRoot)) {
    throw "Refusing to create an integration directory outside the OS temporary root: $testRoot"
}

$process = $null
$processStarted = $false
$testRootCreated = $false
$runId = [guid]::NewGuid().ToString('N')
$passMarker = "MATH_TEST_PASS:$runId"
$failureMarkerPrefix = "MATH_TEST_FAIL:$runId`:"
$capturedOutput = [System.Collections.Generic.List[string]]::new()

try {
    $null = New-Item -ItemType Directory -Path $testRoot
    $testRootCreated = $true

    Set-Content -LiteralPath (Join-Path $testRoot 'eula.txt') -Encoding utf8 -Value 'eula=true'
    Set-Content -LiteralPath (Join-Path $testRoot 'server.properties') -Encoding utf8 -Value @(
        'level-name=world'
        'online-mode=false'
        'enable-command-block=true'
        'function-permission-level=4'
        'sync-chunk-writes=false'
        'enable-query=false'
        'enable-rcon=false'
        'server-port=0'
        'view-distance=2'
        'simulation-distance=2'
        'initial-enabled-packs=vanilla,file/Math,file/MathAssertions'
    )

    $worldDatapacks = Join-Path $testRoot 'world/datapacks'
    $null = New-Item -ItemType Directory -Path $worldDatapacks
    Copy-Item -LiteralPath $packSource -Destination (Join-Path $worldDatapacks 'Math') -Recurse

    $assertionPack = Join-Path $worldDatapacks 'MathAssertions'
    $assertionFunctionRoot = Join-Path $assertionPack 'data/math_test/function'
    $failureFunctionRoot = Join-Path $assertionFunctionRoot 'fail'
    $loadTagRoot = Join-Path $assertionPack 'data/minecraft/tags/function'
    $null = New-Item -ItemType Directory -Path $failureFunctionRoot
    $null = New-Item -ItemType Directory -Path $loadTagRoot
    Set-Content -LiteralPath (Join-Path $assertionPack 'pack.mcmeta') -Encoding utf8 -Value @'
{
  "pack": {
    "description": "Temporary Math integration assertions",
    "min_format": 118,
    "max_format": 118
  }
}
'@
    Set-Content -LiteralPath (Join-Path $loadTagRoot 'load.json') -Encoding utf8 -Value @'
{
  "values": ["math_test:run"]
}
'@

    $assertionCommands = [System.Collections.Generic.List[string]]::new()
    $assertionCommands.Add('scoreboard objectives add math_test dummy')

    function Add-Guard {
        param(
            [Parameter(Mandatory = $true)][string] $Condition,
            [Parameter(Mandatory = $true)][string] $Case
        )

        $assertionCommands.Add("execute $Condition run return run function math_test:fail/$Case")
        Set-Content -LiteralPath (Join-Path $failureFunctionRoot "$Case.mcfunction") -Encoding utf8 -Value @(
            "say $failureMarkerPrefix$Case"
            'return fail'
        )
    }

    function Add-SuccessCase {
        param(
            [Parameter(Mandatory = $true)][string] $Case,
            [Parameter(Mandatory = $true)][string[]] $Setup,
            [Parameter(Mandatory = $true)][string] $Function,
            [Parameter(Mandatory = $true)][string] $ExpectedAnswer
        )

        foreach ($command in $Setup) {
            $assertionCommands.Add($command)
        }
        $assertionCommands.Add('data modify storage math: ans set value -999.0f')
        $assertionCommands.Add('data modify storage math: error set value "stale_error"')
        $assertionCommands.Add("execute store result score #return math_test run function #math:$Function")
        if ($Case -eq 'square_root') {
            $assertionCommands.Add('execute store result score #approx math_test run data get storage math: ans 1000000')
        }
        elseif ($Case -eq 'bezier') {
            $assertionCommands.Add('execute store result score #approx math_test run data get storage math: ans 1000')
        }
        Add-Guard -Condition 'if data storage math: {error:"invalid_number"}' -Case "${Case}_invalid_number"
        Add-Guard -Condition 'if data storage math: {error:"division_by_zero"}' -Case "${Case}_division_by_zero"
        Add-Guard -Condition 'if data storage math: {error:"result_out_of_range"}' -Case "${Case}_result_out_of_range"
        if ($Case -eq 'square_root') {
            Add-Guard -Condition 'unless score #approx math_test matches 1999990..2000010' -Case "${Case}_answer"
        }
        elseif ($Case -eq 'bezier') {
            Add-Guard -Condition 'unless score #approx math_test matches 62748..62751' -Case "${Case}_answer"
        }
        else {
            Add-Guard -Condition "unless data storage math: {ans:${ExpectedAnswer}}" -Case "${Case}_answer"
        }
        Add-Guard -Condition 'if data storage math: error' -Case "${Case}_stale_error"
        Add-Guard -Condition 'unless score #return math_test matches 1' -Case "${Case}_return"
    }

    function Add-ErrorCase {
        param(
            [Parameter(Mandatory = $true)][string] $Case,
            [Parameter(Mandatory = $true)][string[]] $Setup,
            [Parameter(Mandatory = $true)][string] $Function,
            [Parameter(Mandatory = $true)][string] $ExpectedError
        )

        foreach ($command in $Setup) {
            $assertionCommands.Add($command)
        }
        $assertionCommands.Add('data modify storage math: ans set value -999.0f')
        $assertionCommands.Add('data modify storage math: error set value "stale_error"')
        $assertionCommands.Add("execute store result score #return math_test run function #math:$Function")
        Add-Guard -Condition 'unless score #return math_test matches 0' -Case "${Case}_return"
        Add-Guard -Condition 'if data storage math: ans' -Case "${Case}_stale_answer"
        Add-Guard -Condition ('unless data storage math: {{error:"{0}"}}' -f $ExpectedError) -Case "${Case}_error"
    }

    Add-SuccessCase -Case 'add' -Function 'add' -ExpectedAnswer '3.75f' -Setup @(
        'data modify storage math: a set value 1.25f'
        'data modify storage math: b set value 2.5f'
    )
    $assertionCommands.Add('data modify storage math: a set value 3.4028234663852886E38f')
    $assertionCommands.Add('data modify storage math: b set value 3.4028234663852886E38f')
    $assertionCommands.Add('data modify storage math: ans set value 99.0f')
    $assertionCommands.Add('data modify storage math: error set value "stale_error"')
    $assertionCommands.Add('execute store result score #return math_test run function #math:add')
    Add-Guard -Condition 'unless score #return math_test matches 0' -Case 'add_overflow_return'
    Add-Guard -Condition 'if data storage math: ans' -Case 'add_overflow_stale_answer'
    Add-Guard -Condition 'unless data storage math: {error:"result_out_of_range"}' -Case 'add_overflow_error'
    Add-SuccessCase -Case 'signed_divide' -Function 'divide' -ExpectedAnswer '-3.5f' -Setup @(
        'data modify storage math: a set value 7.0f'
        'data modify storage math: b set value -2.0f'
    )
    Add-SuccessCase -Case 'signed_zero_divide' -Function 'divide' -ExpectedAnswer '-0.0f' -Setup @(
        'data modify storage math: a set value 0.0f'
        'data modify storage math: b set value -2.0f'
    )
    Add-SuccessCase -Case 'small_reciprocal' -Function 'reciprocal' -ExpectedAnswer '16384.0f' -Setup @(
        'data modify storage math: a set value 0.00006103515625f'
    )
    Add-SuccessCase -Case 'subnormal_divide_equal' -Function 'divide' -ExpectedAnswer '1.0f' -Setup @(
        'data modify storage math: a set value 1.401298464324817E-45f'
        'data modify storage math: b set value 1.401298464324817E-45f'
    )
    Add-SuccessCase -Case 'subnormal_divide_band' -Function 'divide' -ExpectedAnswer '8388608.0f' -Setup @(
        'data modify storage math: a set value 1.1754943508222875E-38f'
        'data modify storage math: b set value 1.401298464324817E-45f'
    )
    Add-SuccessCase -Case 'subnormal_divide_precision' -Function 'divide' -ExpectedAnswer '1.1723450726535639E-38f' -Setup @(
        'data modify storage math: a set value 1.1754942106924411E-38f'
        'data modify storage math: b set value 1.0026861429214478f'
    )
    Add-SuccessCase -Case 'top_finite_divide' -Function 'divide' -ExpectedAnswer '3.4028234663852886E38f' -Setup @(
        'data modify storage math: a set value 3.4028234663852886E38f'
        'data modify storage math: b set value 1.0f'
    )
    Add-SuccessCase -Case 'round' -Function 'round' -ExpectedAnswer '-1.0f' -Setup @(
        'data modify storage math: a set value -1.5f'
    )
    Add-SuccessCase -Case 'square_root' -Function 'square_root' -ExpectedAnswer '1.9999999f' -Setup @(
        'data modify storage math: a set value 4.0f'
    )
    Add-SuccessCase -Case 'log' -Function 'log' -ExpectedAnswer '0.0f' -Setup @(
        'data modify storage math: a set value 1.0f'
    )
    Add-SuccessCase -Case 'exp' -Function 'exp' -ExpectedAnswer '1.0f' -Setup @(
        'data modify storage math: a set value 0.0f'
    )
    Add-SuccessCase -Case 'power_positive' -Function 'power' -ExpectedAnswer '8.0f' -Setup @(
        'data modify storage math: a set value 2.0f'
        'data modify storage math: b set value 3.0f'
    )
    Add-SuccessCase -Case 'power_negative_base' -Function 'power' -ExpectedAnswer '-8.0f' -Setup @(
        'data modify storage math: a set value -2.0f'
        'data modify storage math: b set value 3.0f'
    )
    Add-SuccessCase -Case 'power_negative_exponent' -Function 'power' -ExpectedAnswer '0.25f' -Setup @(
        'data modify storage math: a set value 2.0f'
        'data modify storage math: b set value -2.0f'
    )
    Add-SuccessCase -Case 'rad' -Function 'rad' -ExpectedAnswer '3.1415927f' -Setup @(
        'data modify storage math: a set value 180.0f'
    )
    Add-SuccessCase -Case 'deg' -Function 'deg' -ExpectedAnswer '180.0f' -Setup @(
        'data modify storage math: a set value 3.1415927f'
    )
    Add-SuccessCase -Case 'bezier' -Function 'bezier' -ExpectedAnswer '62.75f' -Setup @(
        'data modify storage math: t set value 5.0f'
        'data modify storage math: max set value 10.0f'
        'data modify storage math: a set value 0.0f'
        'data modify storage math: b set value 100.0f'
        'data modify storage math: curve set value [0.17f,0.67f,0.83f,0.67f]'
    )
    Add-ErrorCase -Case 'bezier_invalid_duration' -Function 'bezier' -ExpectedError 'invalid_duration' -Setup @(
        'data modify storage math: t set value 0.0f'
        'data modify storage math: max set value 0.0f'
        'data modify storage math: a set value 0.0f'
        'data modify storage math: b set value 1.0f'
        'data modify storage math: curve set value [0.0f,0.0f,1.0f,1.0f]'
    )
    Add-ErrorCase -Case 'bezier_invalid_curve' -Function 'bezier' -ExpectedError 'invalid_curve' -Setup @(
        'data modify storage math: t set value 5.0f'
        'data modify storage math: max set value 10.0f'
        'data modify storage math: a set value 0.0f'
        'data modify storage math: b set value 1.0f'
        'data modify storage math: curve set value [0.0f,0.0f,1.0f]'
    )
    Add-ErrorCase -Case 'bezier_nonnumeric_curve' -Function 'bezier' -ExpectedError 'invalid_curve' -Setup @(
        'data modify storage math: t set value 5.0f'
        'data modify storage math: max set value 10.0f'
        'data modify storage math: a set value 0.0f'
        'data modify storage math: b set value 1.0f'
        'data modify storage math: curve set value ["bad","bad","bad","bad"]'
    )
    Add-SuccessCase -Case 'bezier_integer_curve' -Function 'bezier' -ExpectedAnswer '7.0f' -Setup @(
        'data modify storage math: t set value 0.0f'
        'data modify storage math: max set value 10.0f'
        'data modify storage math: a set value 7.0f'
        'data modify storage math: b set value 11.0f'
        'data modify storage math: curve set value [0,0,1,1]'
    )
    Add-SuccessCase -Case 'bezier_double_curve' -Function 'bezier' -ExpectedAnswer '7.0f' -Setup @(
        'data modify storage math: t set value 0.0f'
        'data modify storage math: max set value 10.0f'
        'data modify storage math: a set value 7.0f'
        'data modify storage math: b set value 11.0f'
        'data modify storage math: curve set value [0.0d,0.0d,1.0d,1.0d]'
    )
    Add-SuccessCase -Case 'bounce_midpoint' -Function 'bounce' -ExpectedAnswer '76.5625f' -Setup @(
        'data modify storage math: t set value 5.0f'
        'data modify storage math: max set value 10.0f'
        'data modify storage math: a set value 0.0f'
        'data modify storage math: b set value 100.0f'
    )
    Add-SuccessCase -Case 'bounce_double_endpoint' -Function 'bounce' -ExpectedAnswer '7.0f' -Setup @(
        'data modify storage math: t set value 0.0d'
        'data modify storage math: max set value 10.0d'
        'data modify storage math: a set value 7.0d'
        'data modify storage math: b set value 11.0d'
    )
    Add-ErrorCase -Case 'bounce_invalid_duration' -Function 'bounce' -ExpectedError 'invalid_duration' -Setup @(
        'data modify storage math: t set value 0.0f'
        'data modify storage math: max set value 0.0f'
        'data modify storage math: a set value 0.0f'
        'data modify storage math: b set value 1.0f'
    )

    $assertionCommands.Add('data modify storage math: t set value 5.0f')
    $assertionCommands.Add('data modify storage math: max set value 20.0f')
    $assertionCommands.Add('data modify storage math: a set value 0.0f')
    $assertionCommands.Add('data modify storage math: b set value 100.0f')
    $assertionCommands.Add('data modify storage math: bounces set value 2.5f')
    $assertionCommands.Add('data modify storage math: decay set value 3.0f')
    $assertionCommands.Add('data modify storage math: ans set value -999.0f')
    $assertionCommands.Add('data modify storage math: error set value "stale_error"')
    $assertionCommands.Add('execute store result score #return math_test run function #math:bounce_decay')
    $assertionCommands.Add('execute store result score #bounce_decay math_test run data get storage math: ans 1000')
    Add-Guard -Condition 'unless score #return math_test matches 1' -Case 'bounce_decay_return'
    Add-Guard -Condition 'unless score #bounce_decay math_test matches 84499..84502' -Case 'bounce_decay_answer'
    Add-Guard -Condition 'if data storage math: error' -Case 'bounce_decay_stale_error'

    Add-SuccessCase -Case 'bounce_decay_double_endpoint' -Function 'bounce_decay' -ExpectedAnswer '11.0f' -Setup @(
        'data modify storage math: t set value 10.0d'
        'data modify storage math: max set value 10.0d'
        'data modify storage math: a set value 7.0d'
        'data modify storage math: b set value 11.0d'
        'data modify storage math: bounces set value 2.5d'
        'data modify storage math: decay set value 3.0d'
    )

    Add-ErrorCase -Case 'bounce_decay_invalid_bounces' -Function 'bounce_decay' -ExpectedError 'invalid_bounce' -Setup @(
        'data modify storage math: t set value 5.0f'
        'data modify storage math: max set value 10.0f'
        'data modify storage math: a set value 0.0f'
        'data modify storage math: b set value 1.0f'
        'data modify storage math: bounces set value 0.0f'
        'data modify storage math: decay set value 3.0f'
    )
    Add-SuccessCase -Case 'sin' -Function 'sin' -ExpectedAnswer '0.0f' -Setup @(
        'data modify storage math: a set value 0.0f'
    )
    Add-SuccessCase -Case 'cos' -Function 'cos' -ExpectedAnswer '1.0f' -Setup @(
        'data modify storage math: a set value 0.0f'
    )
    Add-SuccessCase -Case 'atan_one' -Function 'atan' -ExpectedAnswer '0.7853982f' -Setup @(
        'data modify storage math: a set value 1.0f'
    )
    Add-SuccessCase -Case 'atan_degrees_one_double' -Function 'atan_degrees' -ExpectedAnswer '45.0f' -Setup @(
        'data modify storage math: a set value 1.0d'
    )
    Add-SuccessCase -Case 'atan2_quadrant_two' -Function 'atan2' -ExpectedAnswer '2.3561945f' -Setup @(
        'data modify storage math: a set value 1.0f'
        'data modify storage math: b set value -1.0f'
    )
    Add-SuccessCase -Case 'atan2_degrees_quadrant_three' -Function 'atan2_degrees' -ExpectedAnswer '-135.0f' -Setup @(
        'data modify storage math: a set value -1.0d'
        'data modify storage math: b set value -1.0d'
    )
    Add-SuccessCase -Case 'atan2_double_origin' -Function 'atan2' -ExpectedAnswer '0.0f' -Setup @(
        'data modify storage math: a set value 0.0d'
        'data modify storage math: b set value 0.0d'
    )
    Add-SuccessCase -Case 'atan2_subnormal_ratio' -Function 'atan2' -ExpectedAnswer '0.4636476f' -Setup @(
        'data modify storage math: a set value 1.401298464324817E-45f'
        'data modify storage math: b set value 2.802596928649634E-45f'
    )
    Add-SuccessCase -Case 'atan2_negative_subnormal_ratio' -Function 'atan2' -ExpectedAnswer '-0.4636476f' -Setup @(
        'data modify storage math: a set value -1.401298464324817E-45f'
        'data modify storage math: b set value 2.802596928649634E-45f'
    )
    Add-SuccessCase -Case 'atan2_negative_subnormal_quadrant' -Function 'atan2' -ExpectedAnswer '-2.6779451f' -Setup @(
        'data modify storage math: a set value -1.401298464324817E-45f'
        'data modify storage math: b set value -2.802596928649634E-45f'
    )
    Add-ErrorCase -Case 'atan2_invalid_number' -Function 'atan2' -ExpectedError 'invalid_number' -Setup @(
        'data modify storage math: a set value 1.0f'
        'data modify storage math: b set value 3.5E38d'
    )
    Add-SuccessCase -Case 'asin_minus_one' -Function 'asin' -ExpectedAnswer '-1.5707964f' -Setup @(
        'data modify storage math: a set value -1.0f'
    )
    Add-SuccessCase -Case 'asin_zero' -Function 'asin' -ExpectedAnswer '0.0f' -Setup @(
        'data modify storage math: a set value 0.0f'
    )
    Add-SuccessCase -Case 'asin_one' -Function 'asin' -ExpectedAnswer '1.5707964f' -Setup @(
        'data modify storage math: a set value 1.0f'
    )
    Add-SuccessCase -Case 'asin_one_double' -Function 'asin' -ExpectedAnswer '1.5707964f' -Setup @(
        'data modify storage math: a set value 1.0d'
    )
    Add-SuccessCase -Case 'asin_degrees_minus_one' -Function 'asin_degrees' -ExpectedAnswer '-90.0f' -Setup @(
        'data modify storage math: a set value -1.0f'
    )
    Add-SuccessCase -Case 'asin_degrees_minus_one_int' -Function 'asin_degrees' -ExpectedAnswer '-90.0f' -Setup @(
        'data modify storage math: a set value -1'
    )
    Add-SuccessCase -Case 'asin_degrees_zero' -Function 'asin_degrees' -ExpectedAnswer '0.0f' -Setup @(
        'data modify storage math: a set value 0.0f'
    )
    Add-SuccessCase -Case 'asin_degrees_one' -Function 'asin_degrees' -ExpectedAnswer '90.0f' -Setup @(
        'data modify storage math: a set value 1.0f'
    )
    Add-SuccessCase -Case 'acos_minus_one' -Function 'acos' -ExpectedAnswer '3.1415927f' -Setup @(
        'data modify storage math: a set value -1.0f'
    )
    Add-SuccessCase -Case 'acos_minus_one_byte' -Function 'acos' -ExpectedAnswer '3.1415927f' -Setup @(
        'data modify storage math: a set value -1b'
    )
    Add-SuccessCase -Case 'acos_zero' -Function 'acos' -ExpectedAnswer '1.5707964f' -Setup @(
        'data modify storage math: a set value 0.0f'
    )
    Add-SuccessCase -Case 'acos_one' -Function 'acos' -ExpectedAnswer '0.0f' -Setup @(
        'data modify storage math: a set value 1.0f'
    )
    Add-SuccessCase -Case 'acos_degrees_minus_one' -Function 'acos_degrees' -ExpectedAnswer '180.0f' -Setup @(
        'data modify storage math: a set value -1.0f'
    )
    Add-SuccessCase -Case 'acos_degrees_zero' -Function 'acos_degrees' -ExpectedAnswer '90.0f' -Setup @(
        'data modify storage math: a set value 0.0f'
    )
    Add-SuccessCase -Case 'acos_degrees_one' -Function 'acos_degrees' -ExpectedAnswer '0.0f' -Setup @(
        'data modify storage math: a set value 1.0f'
    )
    Add-SuccessCase -Case 'acos_degrees_one_double' -Function 'acos_degrees' -ExpectedAnswer '0.0f' -Setup @(
        'data modify storage math: a set value 1.0d'
    )

    $assertionCommands.Add('data modify storage math: a set value 0.5f')
    $assertionCommands.Add('data modify storage math: ans set value -999.0f')
    $assertionCommands.Add('data modify storage math: error set value "stale_error"')
    $assertionCommands.Add('execute store result score #return math_test run function #math:asin')
    $assertionCommands.Add('execute store result score #asin_mid_domain math_test run data get storage math: ans 1000000')
    Add-Guard -Condition 'unless score #return math_test matches 1' -Case 'asin_mid_domain_return'
    Add-Guard -Condition 'unless score #asin_mid_domain math_test matches 523597..523601' -Case 'asin_mid_domain_answer'
    Add-Guard -Condition 'if data storage math: error' -Case 'asin_mid_domain_stale_error'

    Add-ErrorCase -Case 'asin_non_real_result' -Function 'asin' -ExpectedError 'non_real_result' -Setup @(
        'data modify storage math: a set value 1.0000001192092896f'
    )
    Add-ErrorCase -Case 'acos_invalid_number' -Function 'acos' -ExpectedError 'invalid_number' -Setup @(
        'data modify storage math: a set value 3.5E38d'
    )
    Add-ErrorCase -Case 'asin_degrees_non_real_result' -Function 'asin_degrees' -ExpectedError 'non_real_result' -Setup @(
        'data modify storage math: a set value 1.0000001192092896f'
    )
    Add-ErrorCase -Case 'acos_degrees_invalid_number' -Function 'acos_degrees' -ExpectedError 'invalid_number' -Setup @(
        'data modify storage math: a set value 3.5E38d'
    )

    $assertionCommands.Add('data modify storage math: rotation set value [0.0f,0.70710677f,0.0f,-0.70710677f]')
    $assertionCommands.Add('data modify storage math: ans set value -999.0f')
    $assertionCommands.Add('data modify storage math: error set value "stale_error"')
    $assertionCommands.Add('execute store result score #return math_test run function #math:quaternion_to_axis_angle')
    $assertionCommands.Add('execute store result score #quaternion_axis_x math_test run data get storage math: ans.axis[0] 1000000')
    $assertionCommands.Add('execute store result score #quaternion_axis_y math_test run data get storage math: ans.axis[1] 1000000')
    $assertionCommands.Add('execute store result score #quaternion_axis_z math_test run data get storage math: ans.axis[2] 1000000')
    $assertionCommands.Add('execute store result score #quaternion_angle math_test run data get storage math: ans.angle 1000000')
    Add-Guard -Condition 'unless score #return math_test matches 1' -Case 'quaternion_to_axis_angle_return'
    Add-Guard -Condition 'if data storage math: error' -Case 'quaternion_to_axis_angle_stale_error'
    Add-Guard -Condition 'unless data storage math: {rotation:[0.0f,0.70710677f,0.0f,-0.70710677f]}' -Case 'quaternion_to_axis_angle_rotation'
    Add-Guard -Condition 'unless data storage math: {ans:{axis:[0.0f,1.0f,0.0f]}}' -Case 'quaternion_to_axis_angle_shape_or_float_leaves'
    Add-Guard -Condition 'unless score #quaternion_axis_x math_test matches -10..10' -Case 'quaternion_to_axis_angle_axis_x'
    Add-Guard -Condition 'unless score #quaternion_axis_y math_test matches 999990..1000010' -Case 'quaternion_to_axis_angle_axis_y'
    Add-Guard -Condition 'unless score #quaternion_axis_z math_test matches -10..10' -Case 'quaternion_to_axis_angle_axis_z'
    Add-Guard -Condition 'unless score #quaternion_angle math_test matches 4712350..4712425' -Case 'quaternion_to_axis_angle_angle'

    $assertionCommands.Add('data modify storage math: rotation set value [0.0f,0.0f,0.0f,1.0f]')
    $assertionCommands.Add('data modify storage math: ans set value -999.0f')
    $assertionCommands.Add('data modify storage math: error set value "stale_error"')
    $assertionCommands.Add('execute store result score #return math_test run function #math:quaternion_to_axis_angle')
    Add-Guard -Condition 'unless score #return math_test matches 1' -Case 'quaternion_to_axis_angle_scalar_return'
    Add-Guard -Condition 'if data storage math: error' -Case 'quaternion_to_axis_angle_scalar_stale_error'
    Add-Guard -Condition 'unless data storage math: {rotation:[0.0f,0.0f,0.0f,1.0f]}' -Case 'quaternion_to_axis_angle_scalar_rotation'
    Add-Guard -Condition 'unless data storage math: {ans:{angle:0.0f,axis:[0.0f,1.0f,0.0f]}}' -Case 'quaternion_to_axis_angle_scalar_angle_float'

    $assertionCommands.Add('data modify storage math: rotation set value [0.0d,0.0d,0.0d,1.0d]')
    $assertionCommands.Add('data modify storage math: ans set value -999.0f')
    $assertionCommands.Add('data modify storage math: error set value "stale_error"')
    $assertionCommands.Add('execute store result score #return math_test run function #math:quaternion_to_axis_angle')
    Add-Guard -Condition 'unless score #return math_test matches 1' -Case 'quaternion_to_axis_angle_double_return'
    Add-Guard -Condition 'if data storage math: error' -Case 'quaternion_to_axis_angle_double_stale_error'
    Add-Guard -Condition 'unless data storage math: {rotation:[0.0d,0.0d,0.0d,1.0d]}' -Case 'quaternion_to_axis_angle_double_rotation'
    Add-Guard -Condition 'unless data storage math: {ans:{angle:0.0f,axis:[0.0f,1.0f,0.0f]}}' -Case 'quaternion_to_axis_angle_double_result'

    Add-ErrorCase -Case 'quaternion_to_axis_angle_zero' -Function 'quaternion_to_axis_angle' -ExpectedError 'invalid_quaternion' -Setup @(
        'data modify storage math: rotation set value [0.0f,0.0f,0.0f,0.0f]'
    )
    Add-ErrorCase -Case 'quaternion_to_axis_angle_malformed' -Function 'quaternion_to_axis_angle' -ExpectedError 'invalid_quaternion' -Setup @(
        'data modify storage math: rotation set value [0.0f,0.0f,0.0f]'
    )

    $assertionCommands.Add('data modify storage math: a set value 1.5707964f')
    $assertionCommands.Add('data modify storage math: ans set value 99.0f')
    $assertionCommands.Add('data modify storage math: error set value "stale_error"')
    $assertionCommands.Add('execute store result score #return math_test run function #math:tan')
    Add-Guard -Condition 'unless score #return math_test matches 0' -Case 'tan_undefined_return'
    Add-Guard -Condition 'if data storage math: ans' -Case 'tan_undefined_stale_answer'
    Add-Guard -Condition 'unless data storage math: {error:"undefined_tangent"}' -Case 'tan_undefined_error'

    $assertionCommands.Add('data modify storage math: a set value 2.938735877055719E-39f')
    $assertionCommands.Add('data modify storage math: ans set value 99.0f')
    $assertionCommands.Add('data modify storage math: error set value "stale_error"')
    $assertionCommands.Add('execute store result score #return math_test run function #math:reciprocal')
    Add-Guard -Condition 'unless score #return math_test matches 0' -Case 'reciprocal_overflow_return'
    Add-Guard -Condition 'if data storage math: ans' -Case 'reciprocal_overflow_stale_answer'
    Add-Guard -Condition 'unless data storage math: {error:"result_out_of_range"}' -Case 'reciprocal_overflow_error'

    $assertionCommands.Add('data modify storage math: a set value 3.4028234663852886E38f')
    $assertionCommands.Add('data modify storage math: b set value 0.99999994039535522f')
    $assertionCommands.Add('data modify storage math: ans set value 99.0f')
    $assertionCommands.Add('data modify storage math: error set value "stale_error"')
    $assertionCommands.Add('execute store result score #return math_test run function #math:divide')
    Add-Guard -Condition 'unless score #return math_test matches 0' -Case 'divide_top_overflow_return'
    Add-Guard -Condition 'if data storage math: ans' -Case 'divide_top_overflow_stale_answer'
    Add-Guard -Condition 'unless data storage math: {error:"result_out_of_range"}' -Case 'divide_top_overflow_error'
    $assertionCommands.Add("say $passMarker")
    Set-Content -LiteralPath (Join-Path $assertionFunctionRoot 'run.mcfunction') -Encoding utf8 -Value $assertionCommands

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $java
    $startInfo.ArgumentList.Add('-jar')
    $startInfo.ArgumentList.Add($serverJar)
    $startInfo.ArgumentList.Add('nogui')
    $startInfo.WorkingDirectory = $testRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw 'Minecraft server process did not start.'
    }
    $processStarted = $true

    $stdoutTask = $process.StandardOutput.ReadLineAsync()
    $stderrTask = $process.StandardError.ReadLineAsync()
    $observedMarker = $null
    $stopSent = $false
    $timedOut = $false
    $deadline = [datetime]::UtcNow.AddSeconds(180)
    $shutdownDeadline = $null

    while ($null -ne $stdoutTask -or $null -ne $stderrTask -or -not $process.HasExited) {
        $activeTasks = [System.Collections.Generic.List[System.Threading.Tasks.Task]]::new()
        if ($null -ne $stdoutTask) {
            $activeTasks.Add($stdoutTask)
        }
        if ($null -ne $stderrTask) {
            $activeTasks.Add($stderrTask)
        }

        if ($activeTasks.Count -gt 0) {
            $whenAny = [System.Threading.Tasks.Task]::WhenAny($activeTasks.ToArray())
            if ($whenAny.Wait(100)) {
                $completedTask = $whenAny.GetAwaiter().GetResult()
                if ([object]::ReferenceEquals($completedTask, $stdoutTask)) {
                    $line = $stdoutTask.GetAwaiter().GetResult()
                    if ($null -eq $line) {
                        $stdoutTask = $null
                    }
                    else {
                        $capturedOutput.Add("STDOUT: $line")
                        [Console]::Out.WriteLine($line)
                        if ($line.Contains($passMarker)) {
                            $observedMarker = $passMarker
                        }
                        elseif ($line.Contains($failureMarkerPrefix)) {
                            $observedMarker = $line.Substring($line.IndexOf($failureMarkerPrefix))
                        }
                        $stdoutTask = $process.StandardOutput.ReadLineAsync()
                    }
                }
                elseif ([object]::ReferenceEquals($completedTask, $stderrTask)) {
                    $line = $stderrTask.GetAwaiter().GetResult()
                    if ($null -eq $line) {
                        $stderrTask = $null
                    }
                    else {
                        $capturedOutput.Add("STDERR: $line")
                        [Console]::Error.WriteLine($line)
                        if ($line.Contains($passMarker)) {
                            $observedMarker = $passMarker
                        }
                        elseif ($line.Contains($failureMarkerPrefix)) {
                            $observedMarker = $line.Substring($line.IndexOf($failureMarkerPrefix))
                        }
                        $stderrTask = $process.StandardError.ReadLineAsync()
                    }
                }
            }
        }
        else {
            Start-Sleep -Milliseconds 100
        }

        if ($null -ne $observedMarker -and -not $stopSent -and -not $process.HasExited) {
            $process.StandardInput.WriteLine('stop')
            $process.StandardInput.Flush()
            $stopSent = $true
            $shutdownDeadline = [datetime]::UtcNow.AddSeconds(30)
        }

        if (-not $timedOut -and [datetime]::UtcNow -ge $deadline) {
            $timedOut = $true
            if (-not $process.HasExited) {
                $process.StandardInput.WriteLine('stop')
                $process.StandardInput.Flush()
                $stopSent = $true
            }
            $shutdownDeadline = [datetime]::UtcNow.AddSeconds(15)
        }

        if ($null -ne $shutdownDeadline -and [datetime]::UtcNow -ge $shutdownDeadline -and -not $process.HasExited) {
            $process.Kill($true)
        }
    }

    $process.WaitForExit()
    if ($timedOut) {
        throw "Minecraft integration test timed out after 180 seconds.`n$($capturedOutput -join [Environment]::NewLine)"
    }
    if ($null -eq $observedMarker) {
        throw "Minecraft integration test exited without a marker (exit code $($process.ExitCode)).`n$($capturedOutput -join [Environment]::NewLine)"
    }
    if ($observedMarker.StartsWith($failureMarkerPrefix, [System.StringComparison]::Ordinal)) {
        throw "Minecraft integration assertion failed: $observedMarker`n$($capturedOutput -join [Environment]::NewLine)"
    }
    if (-not $stopSent) {
        throw 'Minecraft integration marker was observed, but the stop command was not sent.'
    }
    if ($process.ExitCode -ne 0) {
        throw "Minecraft server did not exit cleanly after verification (exit code $($process.ExitCode)).`n$($capturedOutput -join [Environment]::NewLine)"
    }

    Write-Output $passMarker
}
finally {
    if ($processStarted -and $null -ne $process -and -not $process.HasExited) {
        try {
            $process.StandardInput.WriteLine('stop')
            $process.StandardInput.Flush()
        }
        catch {
            # Cleanup still kills the exact child process if its standard input has closed.
        }
        if (-not $process.WaitForExit(5000)) {
            $process.Kill($true)
            $process.WaitForExit()
        }
    }
    if ($null -ne $process) {
        $process.Dispose()
    }

    if ($testRootCreated -and (Test-Path -LiteralPath $testRoot -PathType Container)) {
        $resolvedChild = (Resolve-Path -LiteralPath $testRoot).Path
        $resolvedParent = [System.IO.Directory]::GetParent($resolvedChild).FullName
        if (-not (Test-PathEqual -Left $resolvedChild -Right $testRoot) -or
            -not (Test-PathEqual -Left $resolvedParent -Right $temporaryRoot)) {
            throw "Refusing unsafe integration cleanup target: $resolvedChild"
        }
        Remove-Item -LiteralPath $resolvedChild -Recurse -Force
    }
}
