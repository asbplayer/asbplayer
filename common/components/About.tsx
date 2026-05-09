import React from 'react';
import Box from '@mui/material/Box';
import MuiLink, { type LinkProps } from '@mui/material/Link';
import LogoIcon from './LogoIcon';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import MuiTableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';
import { useTheme, withStyles } from '@mui/styles';
import { type Theme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import SettingsSection from './SettingsSection';

interface Props {
    appVersion?: string;
    extensionVersion?: string;
    insideExtension?: boolean;
}

const Link = ({ children, ...props }: { children: React.ReactNode } & LinkProps) => {
    return (
        <MuiLink target="_blank" color="textPrimary" underline="always" {...props}>
            {children}
        </MuiLink>
    );
};

const TableCell = withStyles((theme) => ({
    head: {
        backgroundColor: theme.palette.action.hover,
    },
    root: {
        border: 0,
    },
}))(MuiTableCell);

const BorderedTableCell = withStyles((theme) => ({
    root: {},
}))(MuiTableCell);

type Dependency = {
    name: string;
    projectLink: string;
    license: string;
    licenseLink: string;
    purpose: string;
    extension?: boolean;
};

const dependencies: Dependency[] = [
    {
        name: 'react',
        projectLink: 'https://react.dev',
        license: 'MIT',
        licenseLink: 'https://github.com/facebook/react/blob/v18.0.0/LICENSE',
        purpose: 'UI',
    },
    {
        name: 'Material UI',
        projectLink: 'https://mui.com/material-ui',
        license: 'MIT',
        licenseLink: 'https://github.com/mui/material-ui/blob/v4.x/LICENSE',
        purpose: 'UI',
    },
    {
        name: 'Roboto',
        projectLink: 'https://fonts.google.com/specimen/Roboto',
        license: 'Apache 2.0',
        licenseLink: 'https://fonts.google.com/specimen/Roboto/license',
        purpose: 'UI',
    },
    {
        name: 'Dexie.js',
        projectLink: 'https://dexie.org',
        license: 'Apache 2.0',
        licenseLink: 'https://github.com/dexie/Dexie.js/blob/master/LICENSE',
        purpose: 'Persistence',
    },
    {
        name: 'flatten-interval-tree',
        projectLink: 'https://github.com/alexbol99/flatten-interval-tree',
        license: 'MIT',
        licenseLink: 'https://github.com/alexbol99/flatten-interval-tree/blob/master/LICENSE',
        purpose: 'Subtitle rendering',
    },
    {
        name: 'srt-parser',
        projectLink: 'https://github.com/qgustavor/srt-parser',
        license: 'MIT',
        licenseLink: 'https://github.com/qgustavor/srt-parser/blob/master/LICENSE',
        purpose: 'Subtitle parsing',
    },
    {
        name: 'ass-compiler',
        projectLink: 'https://github.com/weizhenye/ass-compiler',
        license: 'MIT',
        licenseLink: 'https://github.com/weizhenye/ass-compiler/blob/master/LICENSE',
        purpose: 'Subtitle parsing',
    },
    {
        name: 'pgs-parser',
        projectLink: 'https://github.com/killergerbah/pgs-parser',
        license: 'MIT',
        licenseLink: 'https://github.com/killergerbah/pgs-parser/blob/main/LICENSE.md',
        purpose: 'Subtitle parsing',
    },
    {
        name: 'fast-xml-parser',
        projectLink: 'https://github.com/NaturalIntelligence/fast-xml-parser',
        license: 'MIT',
        licenseLink: 'https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/LICENSE',
        purpose: 'Subtitle parsing',
    },
    {
        name: 'videojs-vtt.js',
        projectLink: 'https://github.com/videojs/vtt.js',
        license: 'Apache 2.0',
        licenseLink: 'https://github.com/videojs/vtt.js/blob/0.15.x/LICENSE',
        purpose: 'Subtitle parsing',
    },
    {
        name: 'semver',
        projectLink: 'https://github.com/npm/node-semver',
        license: 'ISC',
        licenseLink: 'https://github.com/npm/node-semver/blob/main/LICENSE',
        purpose: 'Version string parsing',
    },

    {
        name: 'hotkeys-js',
        projectLink: 'https://github.com/jaywcjlove/hotkeys-js',
        license: 'MIT',
        licenseLink: 'https://github.com/jaywcjlove/hotkeys-js/blob/master/LICENSE',
        purpose: 'Keyboard shortcuts',
    },
    {
        name: 'i18next',
        projectLink: 'https://www.i18next.com',
        license: 'MIT',
        licenseLink: 'https://github.com/i18next/i18next/blob/master/LICENSE',
        purpose: 'Localization',
    },
    {
        name: 'lamejs',
        projectLink: 'https://lame.sourceforge.io',
        license: 'LGPL',
        licenseLink: 'https://github.com/zhuker/lamejs/blob/master/LICENSE',
        purpose: 'MP3 encoding',
    },
    {
        name: 'sanitize-filename',
        projectLink: 'https://github.com/parshap/node-sanitize-filename',
        license: 'ISC+WTFPL',
        licenseLink: 'https://github.com/parshap/node-sanitize-filename/blob/master/LICENSE.md',
        purpose: 'Filename sanitization',
    },
    {
        name: 'uuidjs',
        projectLink: 'https://github.com/uuidjs/uuid',
        license: 'MIT',
        licenseLink: 'https://github.com/uuidjs/uuid/blob/main/LICENSE.md',
        purpose: 'UUID generation',
    },
    {
        name: 'url',
        projectLink: 'https://github.com/defunctzombie/node-url',
        license: 'MIT',
        licenseLink: 'https://github.com/defunctzombie/node-url/blob/master/LICENSE',
        purpose: 'Polyfill',
    },
    {
        name: 'm3u8-parser',
        projectLink: 'https://github.com/videojs/m3u8-parser',
        license: 'Apache 2.0',
        licenseLink: 'https://github.com/videojs/m3u8-parser/blob/main/LICENSE',
        purpose: 'Subtitle detection',
        extension: true,
    },
    {
        name: 'mpd-parser',
        projectLink: 'https://github.com/videojs/mpd-parser',
        license: 'Apache 2.0',
        licenseLink: 'https://github.com/videojs/mpd-parser/blob/main/LICENSE',
        purpose: 'Subtitle detection',
        extension: true,
    },
    {
        name: 'DOMPurify',
        projectLink: 'https://github.com/cure53/DOMPurify',
        license: 'Apache 2.0',
        licenseLink: 'https://github.com/cure53/DOMPurify/blob/main/LICENSE',
        purpose: 'HTML sanitization',
    },
];

const dependencyPurposeCounts: { [key: string]: number } = {};

for (const dep of dependencies) {
    let count = dependencyPurposeCounts[dep.purpose] ?? 0;
    dependencyPurposeCounts[dep.purpose] = count + 1;
}

const About = ({ appVersion, extensionVersion }: Props) => {
    const theme = useTheme<Theme>();
    const { t } = useTranslation();
    const renderedPurpose: { [key: string]: boolean } = {};
    let purposeIndex = 0;
    return (
        <Box p={1} style={{ width: '100%' }}>
            <Box style={{ width: '100%', textAlign: 'center' }}>
                <LogoIcon style={{ width: 48, height: 48 }} />
                <br />
                <Link variant="h5" href="https://github.com/asbplayer/asbplayer">
                    asbplayer
                </Link>
                <br />
                {appVersion && (
                    <>
                        <Typography variant="caption">
                            {t('about.appVersion')}{' '}
                            <Link href={`https://github.com/asbplayer/asbplayer/commit/${appVersion}`}>
                                {appVersion}
                            </Link>
                        </Typography>
                        <br />
                    </>
                )}
                {extensionVersion && (
                    <Typography variant="caption">
                        {t('about.extensionVersion')}{' '}
                        <Link href={`https://github.com/asbplayer/asbplayer/releases/tag/v${extensionVersion}`}>
                            {extensionVersion}
                        </Link>
                    </Typography>
                )}
            </Box>
            <p />
            <SettingsSection>{t('about.license')}</SettingsSection>
            <Paper variant="outlined" style={{ padding: theme.spacing(2), height: 'auto' }}>
                <Typography variant="body2">
                    MIT License
                    <br />
                    <br />
                    Copyright (c) 2020-2026 asbplayer authors
                    <br />
                    <br />
                    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
                    associated documentation files (the &quot;Software&quot;), to deal in the Software without
                    restriction, including without limitation the rights to use, copy, modify, merge, publish,
                    distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
                    Software is furnished to do so, subject to the following conditions:
                    <br />
                    <br />
                    The above copyright notice and this permission notice shall be included in all copies or substantial
                    portions of the Software.
                    <br />
                    <br />
                    THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
                    INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
                    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
                    OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
                    CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
                </Typography>
            </Paper>
            <br />
            <SettingsSection>{t('about.deps')}</SettingsSection>
            <TableContainer variant="outlined" component={Paper} style={{ height: 'auto' }}>
                <Table style={{ margin: 0, padding: 0 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('about.depName')}</TableCell>
                            <TableCell>{t('about.license')}</TableCell>
                            <TableCell>{t('about.purpose')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {dependencies
                            .filter((d) => !d.extension || extensionVersion !== undefined)
                            .map((d, index) => {
                                let alreadyRenderedPurpose: boolean;

                                if (renderedPurpose[d.purpose] === undefined) {
                                    alreadyRenderedPurpose = false;
                                    purposeIndex++;
                                } else {
                                    alreadyRenderedPurpose = true;
                                }

                                renderedPurpose[d.purpose] = true;

                                let CellComponent = TableCell;
                                let nextPurpose = dependencies[index + 1]?.purpose;

                                if (nextPurpose !== undefined && d.purpose !== nextPurpose) {
                                    CellComponent = BorderedTableCell;
                                }

                                const isLastPurposeCell = d.purpose === dependencies[dependencies.length - 1].purpose;

                                return (
                                    <TableRow key={d.name}>
                                        <CellComponent>
                                            {d.projectLink && <Link href={d.projectLink}>{d.name}</Link>}
                                            {!d.projectLink && d.name}
                                        </CellComponent>
                                        <CellComponent>
                                            <Link href={d.licenseLink}>{d.license}</Link>
                                        </CellComponent>
                                        {!alreadyRenderedPurpose && (
                                            <BorderedTableCell
                                                style={!isLastPurposeCell ? {} : { borderBottom: 0 }}
                                                rowSpan={dependencyPurposeCounts[d.purpose]}
                                            >
                                                {d.purpose}
                                            </BorderedTableCell>
                                        )}
                                    </TableRow>
                                );
                            })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default About;
